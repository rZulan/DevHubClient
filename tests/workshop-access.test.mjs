import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import vm from "node:vm"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const require = createRequire(import.meta.url)
const organization = {
  id: "12345678-1234-4234-8234-123456789012", ownerUserId: "owner", name: "Private organization",
  description: "Private", createdAtUtc: "2026-09-21T00:00:00Z", memberCount: 2, teamCount: 0,
}
const user = { id: "member", firstName: "Test", lastName: "Member", email: "test@example.test" }

function loadTs(relativePath, mocks = {}) {
  const path = new URL(relativePath, import.meta.url)
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name),
    // Reproduce a previous tab's saved organization, including after a refresh.
    localStorage: { getItem: () => JSON.stringify([organization]), setItem: () => {} },
  }, { filename: path.pathname })
  return module.exports
}

test("server membership overrides saved organizations on refresh, leave, and direct lookup", () => {
  let data = [organization]
  let current
  const model = loadTs("../src/features/workshop/workshop-data.ts")
  const { WorkshopProvider, useWorkshop } = loadTs("../src/features/workshop/workshop-context.tsx", {
    "@/app/hooks": { useAppSelector: select => select({ auth: { user } }), useAppDispatch: () => action => action },
    "@/features/workshop/workshop-data": model,
    "@/services/api": { useListOrganizationsQuery: () => ({ data, isLoading: false }) },
  })
  function Probe() { current = useWorkshop(); return null }
  const render = () => renderToStaticMarkup(React.createElement(WorkshopProvider, null, React.createElement(Probe)))
  render()
  assert.equal(current.organizationById(organization.id)?.name, organization.name)
  data = []
  render()
  assert.equal(current.organizations.length, 0)
  assert.equal(current.organizationById(organization.id), undefined)
  data = undefined
  render()
  assert.equal(current.organizationById(organization.id), undefined, "local storage cannot grant access while the server is unavailable")
})
