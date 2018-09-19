import { select } from 'd3-selection';
import { createStructuredSelector } from 'reselect';

import getMockStore from 'ngwmn/store.mock';
import drawConstruction from './construction';
import { getConstructionElements, getWellWaterLevel } from '../state';


describe('graph component construction', () => {
    const store = getMockStore();
    let svg;

    beforeEach(() => {
        svg = select('body')
            .append('svg')
                .attr('id', 'svg-container');
    });

    afterEach(() => {
        svg.remove();
    });

    describe('drawConstruction function', () => {
        const selector = createStructuredSelector({
            elements: getConstructionElements('construction'),
            cursorWaterLevel: getWellWaterLevel('construction')
        });

        it('draws screen and casing representations', () => {
            const state = store.getState();
            drawConstruction(svg, selector(state));
            expect(svg.select('.screen').size()).not.toBe(0);
            expect(svg.select('.casing').size()).not.toBe(0);
        });
    });
});