import { Component, input } from '@angular/core';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { ChartBase } from '../chart-base';
import { PatientTrend } from '../../dashboard.models';

@Component({ selector: 'app-patient-visits-chart', template: '<div #chart class="chart" role="img" aria-label="Patient registration trends"></div>', styles: ['.chart{width:100%;height:320px;min-width:0}'] })
export class PatientVisitsChart extends ChartBase {
  readonly data = input.required<PatientTrend[]>();
  protected build(root: am5.Root): void {
    const chart = root.container.children.push(am5xy.XYChart.new(root, { panX: false, panY: false }));
    const x = chart.xAxes.push(am5xy.DateAxis.new(root, { baseInterval: { timeUnit: 'day', count: 1 }, renderer: am5xy.AxisRendererX.new(root, {}) }));
    const y = chart.yAxes.push(am5xy.ValueAxis.new(root, { min: 0, renderer: am5xy.AxisRendererY.new(root, {}) }));
    const series = chart.series.push(am5xy.LineSeries.new(root, { xAxis: x, yAxis: y, valueXField: 'date', valueYField: 'count', stroke: am5.color(0x1f4e79), fill: am5.color(0x6fa3d8) }));
    series.strokes.template.setAll({ strokeWidth: 3 });
    series.data.setAll(this.data().map(item => ({ ...item, date: new Date(item.date).getTime() })));
  }
}

