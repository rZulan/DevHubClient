import test from 'node:test'
import assert from 'node:assert/strict'
import {crc32, inflateSync} from 'node:zlib'
import {encodePng} from '../src/features/workshop/png-stream.ts'

async function decode(blob) {
    const bytes=Buffer.from(await blob.arrayBuffer()),idat=[]
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10])
    let width,height,ended=false
    for(let offset=8;offset<bytes.length;) {
        const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8)
        const data=bytes.subarray(offset+8,offset+8+size)
        assert.equal(bytes.readUInt32BE(offset+8+size),crc32(bytes.subarray(offset+4,offset+8+size)),`${type} checksum`)
        if(type==='IHDR') {width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.deepEqual([...data.subarray(8)],[8,6,0,0,0])}
        if(type==='IDAT') idat.push(data)
        if(type==='IEND') ended=true
        offset+=size+12
        if(ended) assert.equal(offset,bytes.length)
    }
    assert.ok(ended)
    const filtered=inflateSync(Buffer.concat(idat)),stride=width*4,rgba=Buffer.alloc(stride*height)
    assert.equal(filtered.length,(stride+1)*height)
    for(let y=0;y<height;y++) {
        assert.equal(filtered[y*(stride+1)],1)
        for(let x=0;x<stride;x++) rgba[y*stride+x]=(filtered[y*(stride+1)+1+x]+(x<4?0:rgba[y*stride+x-4]))&255
    }
    return {width,height,rgba}
}

test('streamed PNG roundtrips exact RGBA across band boundaries with valid chunks',async()=>{
    const width=4103,height=7,expected=Uint8Array.from({length:width*height*4},(_,i)=>(i*31+(i>>>8))%256),calls=[]
    const blob=await encodePng(width,height,async(y,rows)=>{calls.push([y,rows]);return expected.slice(y*width*4,(y+rows)*width*4)},3)
    assert.equal(blob.type,'image/png')
    const actual=await decode(blob)
    assert.equal(actual.width,width);assert.equal(actual.height,height)
    assert.deepEqual(actual.rgba,Buffer.from(expected))
    assert.deepEqual(calls,[[0,3],[3,3],[6,1]])
})

test('PNG width can exceed a 32767-pixel canvas without downscaling',async()=>{
    const width=40001,height=4
    const actual=await decode(await encodePng(width,height,async(y,rows)=>Uint8Array.from({length:width*rows*4},(_,i)=>(i+y)%256),1))
    assert.equal(actual.width,width);assert.equal(actual.height,height)
    for(let y=0;y<height;y++) for(const x of [0,4095,4096,32767,40000]) for(let c=0;c<4;c++) assert.equal(actual.rgba[(y*width+x)*4+c],(x*4+c+y)%256)
})

test('PNG surfaces rendering failures and incomplete sections instead of downloading corrupt data',async()=>{
    await assert.rejects(encodePng(10,10,async()=>{throw new Error('render failed')}),/render failed/)
    await assert.rejects(encodePng(10,10,async()=>new Uint8Array(4)),/Incomplete/)
    await assert.rejects(encodePng(0,10,async()=>new Uint8Array()),/Invalid/)
})

