import { Component, computed, input } from '@angular/core';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { ChartBase } from '../chart-base';
import { DepartmentAppointments } from '../../dashboard.models';
import { CHART_COLORS } from '../chart-colors';
@Component({
  selector: 'app-appointments-department-chart',
  template:
    '<div #chart class="chart" [style.height.px]="chartHeight()" role="img" aria-label="Visits by department"></div>',
  styles: ['.chart{width:100%;min-width:0}'],
})
export class AppointmentsDepartmentChart extends ChartBase {
  readonly data = input.required<DepartmentAppointments[]>();
  readonly chartHeight = computed(() => Math.max(320, this.data().length * 42));
  protected build(root: am5.Root) {
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, { panX: false, panY: false }),
    );
    const x = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 36 }),
      }),
    );
    const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 28, inversed: true });
    yRenderer.labels.template.setAll({
      maxWidth: 170,
      oversizedBehavior: 'wrap',
      textAlign: 'right',
      fontSize: 12,
    });
    const y = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'department',
        renderer: yRenderer,
      }),
    );
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis: x,
        yAxis: y,
        categoryYField: 'department',
        valueXField: 'count',
        tooltip: am5.Tooltip.new(root, { labelText: '{categoryY}: {valueX}' }),
      }),
    );
    series.columns.template.adapters.add('fill', (_fill, target) => {
      const index = series.dataItems.indexOf(target.dataItem as any);
      return am5.color(CHART_COLORS[Math.max(0, index) % CHART_COLORS.length]);
    });
    series.columns.template.adapters.add('stroke', (_stroke, target) => {
      const index = series.dataItems.indexOf(target.dataItem as any);
      return am5.color(CHART_COLORS[Math.max(0, index) % CHART_COLORS.length]);
    });
    y.data.setAll(this.data());
    series.data.setAll(this.data());
  }
}
