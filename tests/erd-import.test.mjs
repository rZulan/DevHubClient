import test from 'node:test'
import assert from 'node:assert/strict'
import {importErdFile, importErdJson, importErdSql} from '../src/features/workshop/erd-import.ts'
import {cardinalityForEnds, erdSql, newField, relationshipEnds} from '../src/features/workshop/tool-documents.ts'

const schema = `
CREATE TABLE "users" ("id" UUID PRIMARY KEY, "email" VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE "orders" ("id" UUID NOT NULL, "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
 "total" DECIMAL(10,2) NOT NULL DEFAULT 0, "note" TEXT DEFAULT 'Hello, world; it''s SQL', PRIMARY KEY ("id"));
`
test('SQL import preserves types, precision, keys, quoted defaults and optional relationships', () => {
    const {document, warnings} = importErdSql(schema)
    assert.equal(document.tables.length, 2)
    const orders = document.tables.find(table => table.name === 'orders')
    assert.equal(orders.fields.find(field => field.name === 'total').length, '10,2')
    assert.equal(orders.fields.find(field => field.name === 'note').defaultValue, "'Hello, world; it''s SQL'")
    assert.equal(orders.fields.find(field => field.name === 'id').primary, true)
    assert.equal(orders.fields.find(field => field.name === 'id').nullable, false)
    assert.deepEqual(relationshipEnds(document.relationships[0]), {leftEnd: 'zero-one', rightEnd: 'zero-many'})
    assert.equal(document.relationships[0].onDelete, 'SET NULL')
    assert.equal(warnings.length, 0)
})
test('SQL export can be reimported with ALTER TABLE foreign keys and unique constraints', () => {
    const original = importErdSql(schema).document
    const loaded = importErdSql(erdSql(original)).document
    assert.equal(loaded.relationships.length, 1)
    assert.deepEqual(loaded.tables.map(table => ({name: table.name, fields: table.fields.map(({id: _id, ...rest}) => rest)})), original.tables.map(table => ({name: table.name, fields: table.fields.map(({id: _id, ...rest}) => rest)})))
})
test('SQL Server and MySQL identifiers and type aliases are supported', () => {
    const {document} = importErdSql(`CREATE TABLE [dbo].[accounts] ([id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [name] NVARCHAR(120), [active] BIT NOT NULL DEFAULT 1);
      CREATE TABLE \`profiles\` (\`id\` UNIQUEIDENTIFIER NOT NULL UNIQUE, FOREIGN KEY (\`id\`) REFERENCES [dbo].[accounts] ([id]) ON DELETE NO ACTION);`, 'sqlserver')
    assert.equal(document.tables[0].name, 'dbo.accounts')
    assert.equal(document.tables[0].fields[1].type, 'VARCHAR')
    assert.equal(document.tables[0].fields[2].type, 'BOOLEAN')
    assert.equal(document.relationships[0].cardinality, '1:1')
})
test('comments, function defaults and ignored statements are handled without executing SQL', () => {
    const {document, warnings} = importErdSql(`/* CREATE TABLE ignored (bad UNKNOWN); /* nested */ */
      CREATE TABLE logs (id INTEGER PRIMARY KEY, created TIMESTAMP DEFAULT (CURRENT_TIMESTAMP), message TEXT DEFAULT $$with ; and ,$$, CHECK (id > 0));
      INSERT INTO logs VALUES (1, NOW(), 'not executed'); DROP TABLE logs;`)
    assert.equal(document.tables.length, 1)
    assert.equal(document.tables[0].fields[1].defaultValue, '(CURRENT_TIMESTAMP)')
    assert.equal(document.tables[0].fields[2].defaultValue, '$$with ; and ,$$')
    assert.ok(warnings.some(warning => warning.includes('skipped')))
    assert.equal(document.tables[0].checks[0].expression, 'id > 0')
})
test('SQL Server GO batches, clustered keys and trailing inline constraints import correctly', () => {
    const {document} = importErdSql(`CREATE TABLE [parents] ([id] INT, CONSTRAINT [pk] PRIMARY KEY CLUSTERED ([id] ASC))\nGO\nCREATE TABLE [children] ([id] INT PRIMARY KEY, [parent_id] INT REFERENCES [parents] ([id]) NOT NULL)\nGO\n`)
    assert.equal(document.tables.length, 2)
    assert.equal(document.tables[0].fields[0].primary, true)
    assert.equal(document.tables[1].fields[1].nullable, false)
    assert.equal(document.relationships[0].leftEnd, 'one')
})
test('invalid, unsupported and dangling SQL imports fail before replacing a document', () => {
    for (const source of ['DROP TABLE users;', 'CREATE TABLE users (id UNKNOWN);', 'CREATE TABLE users (id INT', "CREATE TABLE users (id INT, name TEXT DEFAULT 'oops);", 'CREATE TABLE users (id INT REFERENCES missing(id));', 'CREATE TABLE users (id INT); CREATE TABLE users (id INT);', 'CREATE TABLE users (id INT, id INT);']) assert.throws(() => importErdSql(source))
    assert.throws(() => importErdSql('CREATE TABLE a (id INT PRIMARY KEY, other INT); CREATE TABLE b (id INT, other INT, FOREIGN KEY (id,other) REFERENCES a(id,other));'), /complete primary or unique key/)
})
test('JSON drafts round trip geometry and custom arrows, including saved-document wrappers', () => {
    const document = importErdSql(schema).document
    document.tables[0].x = -120
    assert.deepEqual(importErdJson(JSON.stringify(document)).document, document)
    assert.deepEqual(importErdJson(JSON.stringify({revision: 23, document})).document, document)
    assert.throws(() => importErdJson('{broken'))
    assert.throws(() => importErdJson(JSON.stringify({layers: []})))
    const broken = structuredClone(document); broken.relationships[0].toField = 'missing'
    assert.throws(() => importErdJson(JSON.stringify(broken)), /dangling/)
    const duplicate = structuredClone(document); duplicate.tables.push(duplicate.tables[0])
    assert.throws(() => importErdJson(JSON.stringify(duplicate)), /duplicate table/)
})
test('endpoint presets derive all four cardinalities and preserve optionality', () => {
    assert.equal(cardinalityForEnds('one', 'zero-one'), '1:1')
    assert.equal(cardinalityForEnds('zero-one', 'zero-many'), '1:N')
    assert.equal(cardinalityForEnds('many', 'one'), 'N:1')
    assert.equal(cardinalityForEnds('zero-many', 'many'), 'N:M')
    assert.deepEqual(relationshipEnds({cardinality: '1:N'}), {leftEnd: 'one', rightEnd: 'many'})
})
test('many-to-one SQL exports the foreign key on the left and referenced key on the right', () => {
    const parent = {id: 'p', name: 'parent', x: 0, y: 0, fields: [{...newField(), id: 'pk'}]}
    const child = {id: 'c', name: 'child', x: 400, y: 0, fields: [{...newField('parent_id'), id: 'fk', type: 'UUID', length: ''}]}
    const document = {tables: [parent, child], relationships: [{id: 'r', fromTable: 'c', fromField: 'fk', toTable: 'p', toField: 'pk', cardinality: 'N:1', leftEnd: 'many', rightEnd: 'one', onDelete: 'CASCADE'}]}
    assert.match(erdSql(document), /ALTER TABLE "child" ADD FOREIGN KEY \("parent_id"\) REFERENCES "parent" \("id"\)/)
    assert.deepEqual(importErdJson(JSON.stringify(document)).document, document)
    assert.throws(() => importErdJson(JSON.stringify({...document, relationships: [{...document.relationships[0], rightEnd: 'many'}]})), /cardinality/)
})
test('file import rejects unrelated extensions and oversized files', () => {
    assert.throws(() => importErdFile(schema, 'schema.txt'), /\.sql/)
    assert.throws(() => importErdFile(' '.repeat(4_000_001), 'schema.sql'), /4 MB/)
})

test('MySQL text/blob sizes and integer aliases import instead of rejecting common dumps', () => {
    const cases = [
        ['TINYTEXT', 'TEXT'], ['MEDIUMTEXT', 'TEXT'], ['LONGTEXT', 'TEXT'],
        ['TINYBLOB', 'BLOB'], ['MEDIUMBLOB', 'BLOB'], ['LONGBLOB', 'BLOB'],
        ['MEDIUMINT', 'INT'], ['INT1', 'INT'], ['INT2', 'INT'], ['INT3', 'INT'], ['INT4', 'INT'], ['INT8', 'BIGINT'],
        ['DEC(12,4)', 'DECIMAL'], ['FIXED(12,4)', 'DECIMAL'], ['TIME(6)', 'TEXT'], ['YEAR', 'INT'],
    ]
    const {document, warnings} = importErdSql(`CREATE TABLE cache (${cases.map(([type], i) => `column_${i} ${type} NOT NULL`).join(', ')});`, 'mysql')
    for (const [i, [, type]] of cases.entries()) {
        assert.equal(document.tables[0].fields[i].type, type)
        assert.equal(document.tables[0].fields[i].nullable, false)
    }
    assert.equal(document.tables[0].fields[12].length, '12,4')
    assert.ok(warnings.some(value => value.includes('MEDIUMTEXT') && value.includes('storage limit')))
    assert.ok(warnings.some(value => value.includes('TIME') && value.includes('TEXT')))
})

test('Laravel-style MySQL cache/job definitions preserve keys, defaults and unsigned warnings', () => {
    const {document, warnings} = importErdSql(`CREATE TABLE cache (
        cache_key varchar(255) NOT NULL PRIMARY KEY, value mediumtext NOT NULL, expiration int NOT NULL
    ); CREATE TABLE jobs (
        id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
        payload longtext NOT NULL, attempts tinyint unsigned NOT NULL DEFAULT 0,
        reserved_at int unsigned DEFAULT NULL, created_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated automatically'
    );`, 'mysql')
    assert.equal(document.tables.length, 2)
    const [cache, jobs] = document.tables
    assert.equal(cache.fields[1].type, 'TEXT')
    assert.equal(jobs.fields[0].type, 'BIGINT')
    assert.equal(jobs.fields[0].autoIncrement, true)
    assert.equal(jobs.fields[0].primary, true)
    assert.equal(jobs.fields[2].defaultValue, '0')
    assert.equal(jobs.fields[3].defaultValue, 'NULL')
    assert.equal(jobs.fields[4].defaultValue, 'CURRENT_TIMESTAMP')
    assert.ok(warnings.some(value => value.includes('UNSIGNED')))
    assert.ok(warnings.some(value => value.includes('ON UPDATE')))
    assert.doesNotMatch(erdSql(document), /DEFAULT CURRENT_TIMESTAMP ON UPDATE/)
})

test('enum/set labels and multi-bit columns retain capacity and do not become booleans', () => {
    const {document, warnings} = importErdSql("CREATE TABLE options (choice ENUM('not null','a,b','it''s okay') DEFAULT 'a,b', flags SET('first','second','third'), bits BIT(8), enabled BIT(1));", 'mysql')
    const fields = document.tables[0].fields
    assert.equal(fields[0].length, '9')
    assert.equal(fields[0].defaultValue, "'a,b'")
    assert.equal(fields[1].length, '18')
    assert.equal(fields[2].type, 'BLOB')
    assert.equal(fields[3].type, 'BOOLEAN')
    assert.ok(warnings.some(value => value.includes('allowed-value')))
    assert.ok(warnings.some(value => value.includes('bit width')))
})

test('PostgreSQL numeric/serial aliases and multiword types map to portable types', () => {
    const {document, warnings} = importErdSql(`CREATE TABLE examples (
        id smallserial PRIMARY KEY, large serial8, i int2, n int4, b int8, f float4, d float8,
        label CHARACTER VARYING(80), national NATIONAL CHARACTER VARYING(90), native pg_catalog.int4,
        duration interval, clock timetz, updated timestamp(6) with time zone, mask bit(12)
    );`)
    const fields = document.tables[0].fields
    assert.equal(fields[0].autoIncrement, true)
    assert.equal(fields[1].autoIncrement, true)
    assert.equal(fields[1].type, 'BIGINT')
    assert.deepEqual(fields.slice(2, 7).map(field => field.type), ['INT', 'INT', 'BIGINT', 'FLOAT', 'FLOAT'])
    assert.equal(fields[7].length, '80')
    assert.equal(fields[8].length, '90')
    assert.equal(fields[9].type, 'INT')
    assert.equal(fields[10].type, 'TEXT')
    assert.equal(fields[13].type, 'BLOB')
    assert.ok(warnings.some(value => value.includes('Timezone')))
})

test('SQL Server quoted builtins, money, time and binary rowversions import by target dialect', () => {
    const {document, warnings} = importErdSql(`CREATE TABLE [examples] (
        [id] [sys].[int] IDENTITY(1,1) PRIMARY KEY, [name] [nvarchar](100),
        [amount] [money], [small_amount] smallmoney, [short_name] sysname,
        [created] smalldatetime, [clock] time(7), [offset] datetimeoffset(7), [image] image,
        [version] rowversion, [legacy_version] timestamp
    );`, 'sqlserver')
    const fields = document.tables[0].fields
    assert.equal(fields[0].autoIncrement, true)
    assert.equal(fields[1].length, '100')
    assert.equal(fields[2].type, 'DECIMAL')
    assert.equal(fields[2].length, '19,4')
    assert.equal(fields[3].length, '10,4')
    assert.equal(fields[4].length, '128')
    assert.deepEqual(fields.slice(5).map(field => field.type), ['TIMESTAMP', 'TEXT', 'TIMESTAMP', 'BLOB', 'BLOB', 'BLOB'])
    assert.ok(warnings.some(value => value.includes('automatic version generation')))
    assert.equal(importErdSql('CREATE TABLE example (created timestamp);', 'postgresql').document.tables[0].fields[0].type, 'TIMESTAMP')
})

test('SQLite multiword type names and MySQL SERIAL use their declared families', () => {
    const {document} = importErdSql('CREATE TABLE examples (a UNSIGNED BIG INT, b VARYING CHARACTER(24), c NATIVE CHARACTER(20), d DOUBLE PRECISION);', 'sqlite')
    assert.deepEqual(document.tables[0].fields.map(field => field.type), ['BIGINT', 'VARCHAR', 'VARCHAR', 'FLOAT'])
    const mysql = importErdSql('CREATE TABLE examples (id SERIAL);', 'mysql').document
    assert.equal(mysql.tables[0].fields[0].type, 'BIGINT')
    assert.equal(mysql.tables[0].fields[0].unique, true)
    assert.match(erdSql(mysql), /BIGINT AUTO_INCREMENT NOT NULL UNIQUE/)
})

test('arrays and user-defined qualified types fail clearly instead of silently losing their type', () => {
    for (const type of ['INT[]', 'INT[8]', 'INT ARRAY', 'TIMESTAMP WITH TIME ZONE ARRAY']) assert.throws(() => importErdSql(`CREATE TABLE examples (value ${type});`), /array/i)
    assert.throws(() => importErdSql('CREATE TABLE examples (value public.custom_type);'), /Custom types/)
    assert.throws(() => importErdSql('CREATE TABLE examples (value UUID.custom_type);'), /Custom types/)
    assert.equal(importErdSql("CREATE TABLE examples (value TEXT DEFAULT '[]');").document.tables[0].fields[0].type, 'TEXT')
})
