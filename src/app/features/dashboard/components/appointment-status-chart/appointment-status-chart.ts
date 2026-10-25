import { Component, input } from '@angular/core';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import { ChartBase } from '../chart-base';
import { AppointmentStatusDatum } from '../../dashboard.models';
import { APPOINTMENT_STATUS_COLORS, CHART_COLORS } from '../chart-colors';
@Component({
  selector: 'app-appointment-status-chart',
  template:
    '<div #chart class="chart" role="img" aria-label="Appointment status distribution"></div>',
  styles: ['.chart{width:100%;height:320px;min-width:0}'],
})
export class AppointmentStatusChart extends ChartBase {
  readonly data = input.required<AppointmentStatusDatum[]>();
  protected build(root: am5.Root) {
    root.interfaceColors.set('grid', am5.color(0xa4c8e1));
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, { layout: root.verticalLayout, innerRadius: am5.percent(58) }),
    );
    const series = chart.series.push(
      am5percent.PieSeries.new(root, { valueField: 'count', categoryField: 'status' }),
    );
    series.get('colors')?.set(
      'colors',
      this.data().map((item, index) =>
        am5.color(
          APPOINTMENT_STATUS_COLORS[item.status] ?? CHART_COLORS[index % CHART_COLORS.length],
        ),
      ),
    );
    series.labels.template.set('forceHidden', true);
    series.ticks.template.set('forceHidden', true);
    series.data.setAll(this.data());
    chart.children
      .push(am5.Legend.new(root, { centerX: am5.percent(50), x: am5.percent(50) }))
      .data.setAll(series.dataItems);
  }
}
