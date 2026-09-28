import { Component, input } from '@angular/core';
import * as am5 from '@amcharts/amcharts5'; import * as am5xy from '@amcharts/amcharts5/xy';
import { ChartBase } from '../chart-base'; import { DepartmentAppointments } from '../../dashboard.models';
@Component({ selector:'app-appointments-department-chart', template:'<div #chart class="chart" role="img" aria-label="Appointments by department"></div>', styles:['.chart{width:100%;height:320px;min-width:0}'] })
export class AppointmentsDepartmentChart extends ChartBase { readonly data=input.required<DepartmentAppointments[]>(); protected build(root:am5.Root){ const chart=root.container.children.push(am5xy.XYChart.new(root,{panX:false,panY:false})); const x=chart.xAxes.push(am5xy.CategoryAxis.new(root,{categoryField:'department',renderer:am5xy.AxisRendererX.new(root,{minGridDistance:30})})); const y=chart.yAxes.push(am5xy.ValueAxis.new(root,{min:0,renderer:am5xy.AxisRendererY.new(root,{})})); const series=chart.series.push(am5xy.ColumnSeries.new(root,{xAxis:x,yAxis:y,categoryXField:'department',valueYField:'count',fill:am5.color(0x3b7a99),stroke:am5.color(0x3b7a99)})); x.data.setAll(this.data()); series.data.setAll(this.data()); } }

