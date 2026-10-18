import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { provinceFillOpacity, cityFillOpacity, pickerFillOpacity } from '../web/src/map/paint.ts';

const requireWeb = createRequire(new URL('../web/package.json', import.meta.url));
const { validateStyleMin } = requireWeb('@maplibre/maplibre-gl-style-spec');

for (const withBasemap of [false, true]) {
  test(`MapLibre accepts all fill expressions with basemap=${withBasemap}`, () => {
    const style = {
      version: 8,
      sources: { boundaries: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
      layers: [provinceFillOpacity, cityFillOpacity, pickerFillOpacity].map((expression, index) => ({
        id: `boundary-${index}`, type: 'fill', source: 'boundaries',
        paint: { 'fill-opacity': expression(withBasemap) },
      })),
    };
    assert.deepEqual(validateStyleMin(style).map(error => error.message), []);
  });
}
