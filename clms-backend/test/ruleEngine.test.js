const test = require('node:test');
const assert = require('node:assert/strict');
const RuleEngine = require('../src/engine/ruleEngine');

test('RuleEngine keeps a point inside radius as safe', () => {
    const result = RuleEngine.evaluateRule(
        { lat: 10.8, lng: 106.7 },
        {
            id: 'point-1',
            type: 'point',
            center: { lat: 10.8, lng: 106.7 },
            radius: 50
        }
    );

    assert.equal(result.isSafe, true);
    assert.equal(result.reason, 'inside_radius');
});

test('RuleEngine flags a point outside rectangle as violation', () => {
    const result = RuleEngine.evaluateRule(
        { lat: 10.82, lng: 106.73 },
        {
            id: 'zone-1',
            type: 'rectangle',
            bounds: {
                minLat: 10.79,
                maxLat: 10.81,
                minLng: 106.69,
                maxLng: 106.71
            }
        }
    );

    assert.equal(result.isSafe, false);
    assert.equal(result.reason, 'outside_rectangle');
});

test('RuleEngine keeps a point inside polygon as safe', () => {
    const result = RuleEngine.evaluateRule(
        { lat: 10.8, lng: 106.7 },
        {
            id: 'polygon-1',
            type: 'polygon',
            polygonPoints: [
                { lat: 10.79, lng: 106.69 },
                { lat: 10.81, lng: 106.69 },
                { lat: 10.8, lng: 106.71 }
            ]
        }
    );

    assert.equal(result.isSafe, true);
    assert.equal(result.reason, 'inside_polygon');
});
