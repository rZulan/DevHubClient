import test from 'node:test'
import assert from 'node:assert/strict'
import {boundTornadoCamera, createTornadoScene, defaultTornadoCamera, elasticTornadoCamera, tornadoHue, tornadoLabels, tornadoPoint, tornadoProjection} from '../src/features/workshop/tornado-geometry.ts'
import {advanceSdlc, setSdlcPhase, startSdlcCycle, validSdlcDocument} from '../src/features/workshop/sdlc-document.ts'

test('each completed iteration adds a higher, wider layer without changing earlier stars or colors', () => {
    let document={model:'iterative',currentPhase:0,completed:false,notes:{planning:'First plan'}}
    for (let cycle=1;cycle<=5;cycle++) {
        const scene=createTornadoScene(document.cycle??1)
        assert.equal(scene.layers.length,cycle)
        assert.equal(scene.layers.reduce((count,layer)=>count+layer.phases.length,0),cycle*6)
        assert.equal(scene.layers[0].hue,tornadoHue(1))
        assert.deepEqual(scene.layers[0].phases,createTornadoScene(1).layers[0].phases)
        if(cycle>1) {
            const previous=scene.layers[cycle-2], current=scene.layers[cycle-1]
            assert.ok(current.phases[0].y>previous.phases.at(-1).y)
            assert.ok(Math.max(...current.phases.map(p=>Math.hypot(p.x,p.z)))>Math.max(...previous.phases.map(p=>Math.hypot(p.x,p.z))))
            assert.notEqual(current.hue,previous.hue)
        }
        document=startSdlcCycle(advanceSdlc(setSdlcPhase(document,5)))
        assert.equal(validSdlcDocument(document),true)
    }
    assert.equal(document.history[0].notes.planning,'First plan')
    const reloaded=JSON.parse(JSON.stringify(document))
    assert.deepEqual(createTornadoScene(reloaded.cycle),createTornadoScene(document.cycle))
})

test('perspective and depth change during orbit; the tornado is not a rotated flat illustration', () => {
    const scene=createTornadoScene(3), viewport={width:800,height:600}
    const front=tornadoProjection(scene,{...defaultTornadoCamera,yaw:0,pitch:0},viewport)
    const side=tornadoProjection(scene,{...defaultTornadoCamera,yaw:Math.PI/2,pitch:0},viewport)
    const point=tornadoPoint(2,.3)
    assert.notEqual(front(point).x,side(point).x)
    assert.notEqual(front(point).depth,side(point).depth)
    const near=front({x:20,y:scene.height/2,z:80}), far=front({x:20,y:scene.height/2,z:-80})
    assert.ok(near.perspective>far.perspective)
    assert.ok(near.x>far.x)
})

test('fitted geometry, including the funnel rim, stays inside desktop and phone viewports', () => {
    for(const count of [1,4,30,1001]) for(const viewport of [{width:800,height:600},{width:390,height:300}]) for(const pitch of [-1.28,-.22,0,.9]) {
        const scene=createTornadoScene(count)
        const project=tornadoProjection(scene,{...defaultTornadoCamera,pitch},viewport)
        for(const points of [...scene.layers.map(layer=>layer.points),...scene.guides]) for(const point of points) {
            const result=project(point)
            assert.ok(Number.isFinite(result.x)&&Number.isFinite(result.y)&&Number.isFinite(result.depth))
            assert.ok(result.x>=0&&result.x<=viewport.width)
            assert.ok(result.y>=0&&result.y<=viewport.height)
        }
    }
})

test('colors are stable and distinct across the supported iteration history, with bounded geometry cost', () => {
    const scene=createTornadoScene(1001)
    assert.equal(new Set(scene.layers.map(layer=>layer.hue)).size,1001)
    assert.ok(scene.layers.reduce((count,layer)=>count+layer.points.length,0)<15000)
    for(const layer of scene.layers) assert.equal(layer.hue,tornadoHue(layer.cycle))
})

test('camera limits preserve rotation and zoom while panning resists and springs back to its bounds', () => {
    const viewport={width:400,height:300}
    const raw={yaw:18,pitch:8,zoom:20,panX:99999,panY:-99999}
    const bound=boundTornadoCamera(raw,viewport), elastic=elasticTornadoCamera(raw,viewport)
    assert.equal(bound.zoom,5)
    assert.equal(bound.pitch,1.32)
    assert.ok(Math.abs(bound.yaw)<=Math.PI)
    assert.ok(elastic.panX>bound.panX && elastic.panX<=bound.panX+64)
    assert.ok(elastic.panY<bound.panY && elastic.panY>=bound.panY-64)
    assert.deepEqual(boundTornadoCamera(elastic,viewport),bound)
})

test('phase labels separate vertically without detaching from their projected star coordinates', () => {
    const points=Array.from({length:6},()=>({x:180,y:100}))
    const labels=tornadoLabels(points,{width:390,height:300}).sort((a,b)=>a.labelY-b.labelY)
    assert.ok(labels[0].labelY>=40)
    assert.ok(labels.at(-1).labelY<=258)
    for(let index=1;index<labels.length;index++) assert.ok(labels[index].labelY-labels[index-1].labelY>=28)
    assert.ok(labels.every(label=>label.x===180&&label.y===100))
})
