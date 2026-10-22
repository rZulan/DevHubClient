import test from 'node:test'
import assert from 'node:assert/strict'
import {notePeelShape, projectNotePoint, noteHoverProgress} from '../src/features/workshop/note-preview-motion.ts'

test('resting notes have no cutout, curl, or underside', () => {
    assert.deepEqual(notePeelShape(370, 250, 0), {flatClip:'none',frontPath:'',backPath:''})
    assert.deepEqual(projectNotePoint(370,250,[20,20],0),[20,20])
})

test('hover is 13 percent and reveals a connected back face while the top stays attached', () => {
    assert.equal(noteHoverProgress,.13)
    const shape=notePeelShape(370,250,noteHoverProgress)
    assert.ok(shape.frontPath)
    assert.ok(shape.backPath)
    assert.deepEqual(projectNotePoint(370,250,[40,0],noteHoverProgress),[40,0])
})

test('every curl face remains one closed surface throughout hover, opening, and closing', () => {
    for(const [width,height] of [[280,242],[370,290],[600,500]]) {
        for(let step=1;step<=100;step++) {
            const shape=notePeelShape(width,height,step/100)
            for(const path of [shape.frontPath,shape.backPath]) {
                if(!path) continue
                assert.equal((path.match(/M/g)??[]).length,1,'no disconnected pieces')
                assert.equal((path.match(/Z/g)??[]).length,1,'one closed outline')
                assert.doesNotMatch(path,/NaN|Infinity/)
            }
        }
    }
})

test('early hover does not invent a square tip outside the real rounded corner', () => {
    for(const progress of [.001,.005,.01]) {
        const shape=notePeelShape(370,250,progress,5)
        assert.equal(shape.frontPath,'')
        assert.equal(shape.backPath,'')
    }
})

test('hover curl stays inside the original paper outline without expanding its edges', () => {
    for (const [width,height] of [[280,242],[370,290],[600,500],[1024,242]]) {
        for (let step=1;step<=26;step++) {
            const shape=notePeelShape(width,height,noteHoverProgress*step/26)
            for (const path of [shape.frontPath,shape.backPath]) {
                const coordinates=(path.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number)
                for (let i=0;i<coordinates.length;i+=2) {
                    const x=coordinates[i],y=coordinates[i+1]
                    assert.ok(x>=0 && x<=width,`curl x ${x} stays inside width ${width}`)
                    assert.ok(y>=0 && y<=height,`curl y ${y} stays inside height ${height}`)
                    const dx=Math.max(5-x,0,x-(width-5)),dy=Math.max(5-y,0,y-(height-5))
                    assert.ok(dx*dx+dy*dy<=25.01,'curl respects the rounded corner')
                }
            }
        }
    }
})

test('underside covers the light front at the curl silhouette near completion', () => {
    function outerEdge(path) {
        const coordinates=(path.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number)
        let edge=-Infinity
        for(let i=0;i<coordinates.length;i+=2) edge=Math.max(edge,.45*coordinates[i]+Math.sqrt(1-.45**2)*coordinates[i+1])
        return edge
    }
    for(const [width,height] of [[280,242],[370,290],[600,500],[1024,242]]) {
        for(let step=80;step<=100;step++) {
            const shape=notePeelShape(width,height,step/100)
            assert.ok(outerEdge(shape.frontPath)<=outerEdge(shape.backPath)+.01,
                `light front stays behind the underside at ${step}% for ${width}×${height}`)
        }
    }
})
