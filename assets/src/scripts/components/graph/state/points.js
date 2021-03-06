import { extent } from 'd3-array';
import memoize from 'fast-memoize';
import { createSelector } from 'reselect';

import { getWaterLevels } from 'ngwmn/services/state/index';

import { getViewport } from './layout';
import { getWellLogExtentY } from './well-log';


// Lines will be split if the difference exceeds 6 months.
export const MAX_LINE_POINT_GAP =
    182/*days*/ * 24/*hrs*/ * 60/*min*/ * 60/*sec*/ * 1000/*ms*/;

// 20% padding around the y-domain
const PADDING_RATIO = 0.2;


export const getCurrentWaterLevels = memoize(opts => createSelector(
    getWaterLevels,
    (waterLevels) => {
        return waterLevels[opts.siteKey] || {};
    }
));

export const getCurrentWaterLevelUnit = memoize(opts => createSelector(
    getCurrentWaterLevels(opts),
    (waterLevels) => {
        if (waterLevels.samples && waterLevels.samples.length) {
            return waterLevels.samples[0].unit;
        } else {
            return null;
        }
    }
));

/**
 * Selector to return points visible on the current chart view.
 * @type {Array} List of visible points
 */
export const getChartPoints = memoize(opts => createSelector(
    getCurrentWaterLevels(opts),
    (waterLevels) => {
        const samples = waterLevels.samples || [];
        return samples.map(datum => {
            return {
                dateTime: new Date(datum.time),
                value: parseFloat(datum.fromLandsurfaceValue),
                class: {
                    A: 'approved',
                    P: 'provisional'
                }[datum.comment] || null
            };
        }).sort((a, b) => {
            return a.dateTime.getTime() - b.dateTime.getTime();
        });
    }
));

export const getExtentX = memoize(opts => createSelector(
    getChartPoints(opts),
    (chartPoints) => {
        return extent(chartPoints, pt => pt.dateTime);
    }
));

export const getDomainX = memoize((opts, chartType) => createSelector(
    getExtentX(opts),
    getViewport(opts),
    (extentX, viewport) => {
        if (chartType === 'main' && viewport) {
            return viewport;
        }
        return extentX;
    }
));

export const getDomainY = memoize((opts, chartType) => createSelector(
    getChartPoints(opts),
    getWellLogExtentY(opts),
    (chartPoints, wellLogExtentY) => {
        const values = chartPoints.map(pt => pt.value);
        if (values.length === 0) {
            return [0, 0];
        }

        let domain = [
            Math.min(...values),
            Math.max(...values)
        ];

        // For the lithology and construction charts, take into account the
        // well log's extent and go to zero (or negative, for artesian wells).
        if (chartType === 'lithology' || chartType === 'construction') {
            domain = [
                Math.min(0, wellLogExtentY[0], domain[0]),
                Math.max(wellLogExtentY[1], domain[1])
            ];
        }

        const isPositive = domain[0] >= 0 && domain[1] >= 0;

        // Pad domains on both ends by PADDING_RATIO.
        if (chartType !== 'lithology' && chartType !== 'construction') {
            const padding = PADDING_RATIO * (domain[1] - domain[0]);
            domain = [
                domain[0] - padding,
                domain[1] + padding
            ];
        }

        return [
            isPositive ? Math.max(0, domain[0]) : domain[0],
            domain[1]
        ];
    }
));

/**
 * Returns all points in the current time series split into line segments.
 * @param  {Object} state     Redux store
 * @return {Array} List of lines segments
 */
export const getLineSegments = memoize(opts => createSelector(
    getChartPoints(opts),
    (points) => {
        let lines = [];

        // Accumulate data into line groups, splitting on the estimated and
        // approval status.
        let lastClass;

        for (let pt of points) {
            // Split lines if the gap from the period point exceeds
            // MAX_LINE_POINT_GAP.
            let splitOnGap = false;
            if (lines.length > 0) {
                const lastPoints = lines[lines.length - 1].points;
                const lastPtDateTime = lastPoints[lastPoints.length - 1].dateTime;
                if (pt.dateTime - lastPtDateTime > MAX_LINE_POINT_GAP) {
                    splitOnGap = true;
                }
            }

            // If this point doesn't have the same classes as the last point,
            // create a new line for it.
            if (lastClass !== pt.class || splitOnGap) {
                lines.push({
                    class: pt.class || 'unclassed',
                    points: []
                });
            }

            // Add this point to the current line.
            lines[lines.length - 1].points.push(pt);

            // Cache the class for the next loop iteration.
            lastClass = pt.class;
        }
        return lines;
    }
));

export const getActiveClasses = memoize(opts => createSelector(
    getChartPoints(opts),
    (chartPoints) => {
        return {
            approved: chartPoints.some(pt => pt.class === 'approved'),
            provisional: chartPoints.some(pt => pt.class === 'provisional')
        };
    }
));
