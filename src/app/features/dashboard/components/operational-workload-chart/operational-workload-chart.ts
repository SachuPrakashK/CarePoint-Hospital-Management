import { Component, input } from '@angular/core';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { ChartBase } from '../chart-base';
import { CHART_COLORS } from '../chart-colors';
import { OperationalDatum } from '../../dashboard.models';
@Component({
  selector: 'app-operational-workload-chart',
  templateUrl: './operational-workload-chart.html',
})
export class OperationalWorkloadChart extends ChartBase {
  readonly data = input.required<OperationalDatum[]>();
  protected build(root: am5.Root) {
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, { panX: false, panY: false }),
    );
    const x = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'label',
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 25 }),
      }),
    );
    const y = chart.yAxes.push(
      am5xy.ValueAxis.new(root, { min: 0, renderer: am5xy.AxisRendererY.new(root, {}) }),
    );
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis: x,
        yAxis: y,
        categoryXField: 'label',
        valueYField: 'count',
        tooltip: am5.Tooltip.new(root, { labelText: '{categoryX}: {valueY}' }),
      }),
    );
    series.columns.template.adapters.add('fill', (_fill, target) =>
      am5.color(Number((target.dataItem?.dataContext as any)?.color ?? CHART_COLORS[0])),
    );
    series.columns.template.adapters.add('stroke', (_stroke, target) =>
      am5.color(Number((target.dataItem?.dataContext as any)?.color ?? CHART_COLORS[0])),
    );
    const data = this.data().map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
    x.data.setAll(data);
    series.data.setAll(data);
  }
}
