'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, Space, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { biomarkerPoints, journeyEnd, journeyStart } from '../data';
import { useJourneyStore } from '../store';
import { MetricCards } from './MetricCards';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const { Text } = Typography;

export function BiomarkerTrendChart() {
  const selectedDate = useJourneyStore((state) => state.selectedDate);
  const zoom = useJourneyStore((state) => state.zoom);
  const setZoom = useJourneyStore((state) => state.setZoom);
  const setSelectedEvent = useJourneyStore((state) => state.setSelectedEvent);

  const option = useMemo(() => {
    const axisData = biomarkerPoints.map((item) => item.date);
    return {
      animationDuration: 550,
      color: ['#2f6bff', '#1fa463', '#ff7a00', '#10a6b8', '#7c4dff'],
      grid: {
        left: 48,
        right: 56,
        top: 44,
        bottom: 56
      },
      legend: {
        top: 0,
        right: 44,
        itemWidth: 18,
        itemHeight: 8,
        textStyle: { color: '#28466f', fontSize: 12, fontWeight: 600 },
        data: ['SLEDAI', 'C3 (g/L)', 'ESR (mm/h)', '24h尿蛋白 (g)', 'IgG (g/L)', '选中时间点']
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#cfe3ff',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#1f2f55', fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: '#2f6bff', width: 1, type: 'dashed' } }
      },
      xAxis: {
        type: 'time',
        min: journeyStart,
        max: journeyEnd,
        axisLine: { lineStyle: { color: '#dbe8ff' } },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: '#edf3ff' } },
        axisLabel: { color: '#526786', fontSize: 12 }
      },
      yAxis: [
        {
          type: 'value',
          name: '',
          min: 0,
          max: 24,
          splitNumber: 4,
          axisLine: { show: false },
          axisLabel: { color: '#526786' },
          splitLine: { lineStyle: { color: '#edf3ff' } }
        },
        {
          type: 'value',
          min: 0,
          max: 150,
          splitNumber: 3,
          position: 'right',
          axisLabel: { color: '#526786' },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'slider',
          show: true,
          height: 26,
          bottom: 10,
          left: 48,
          right: 56,
          start: zoom.start,
          end: zoom.end,
          brushSelect: true,
          backgroundColor: '#eff6ff',
          fillerColor: 'rgba(47, 107, 255, 0.14)',
          borderColor: '#95baff',
          handleIcon: 'path://M10,0 L14,0 L14,32 L10,32 Z M18,0 L22,0 L22,32 L18,32 Z',
          handleSize: '110%',
          handleStyle: { color: '#ffffff', borderColor: '#3b82f6', shadowBlur: 4, shadowColor: 'rgba(60,120,255,0.22)' },
          textStyle: { color: '#58719e' }
        },
        { type: 'inside', start: zoom.start, end: zoom.end }
      ],
      series: [
        {
          name: 'SLEDAI',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2.5 },
          areaStyle: { opacity: 0.06 },
          data: biomarkerPoints.map((item) => [item.date, item.sledai])
        },
        {
          name: 'C3 (g/L)',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
          data: biomarkerPoints.map((item) => [item.date, Number((item.c3 * 10).toFixed(2))])
        },
        {
          name: 'ESR (mm/h)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.05 },
          data: biomarkerPoints.map((item) => [item.date, item.esr])
        },
        {
          name: '24h尿蛋白 (g)',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
          data: biomarkerPoints.map((item) => [item.date, Number((item.protein24h * 10).toFixed(2))])
        },
        {
          name: 'IgG (g/L)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
          data: biomarkerPoints.map((item) => [item.date, item.igg * 6])
        },
        {
          name: '选中时间点',
          type: 'scatter',
          data: axisData.includes(selectedDate) ? [[selectedDate, 0]] : [],
          markLine: {
            silent: true,
            symbol: ['none', 'circle'],
            symbolSize: [0, 8],
            label: {
              show: true,
              position: 'insideEndTop',
              formatter: selectedDate,
              color: '#ffffff',
              backgroundColor: '#2f6bff',
              padding: [5, 8],
              borderRadius: 6,
              fontWeight: 700
            },
            lineStyle: { color: '#2f6bff', type: 'dashed', width: 1.4, opacity: 0.72 },
            data: [{ xAxis: selectedDate }]
          }
        }
      ]
    };
  }, [selectedDate, zoom.end, zoom.start]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        const value = Array.isArray(params.value) ? params.value[0] : null;
        if (value) setSelectedEvent(null, value);
      },
      datazoom: (params: any) => {
        const payload = Array.isArray(params.batch) ? params.batch[0] : params;
        if (typeof payload?.start === 'number' && typeof payload?.end === 'number') {
          setZoom({ start: payload.start, end: payload.end });
        }
      }
    }),
    [setSelectedEvent, setZoom]
  );

  return (
    <Card
      className="journey-card biomarker-card"
      title={
        <Space size={8}>
          <span>关键指标趋势</span>
          <span className="title-separator">|</span>
          <Text className="title-en">Biomarker Trends</Text>
          <Tooltip title="与上方事件轴共享缩放范围，点击曲线点可同步选中时间点">
            <InfoCircleOutlined className="title-info" />
          </Tooltip>
        </Space>
      }
    >
      <MetricCards />
      <ReactECharts option={option} onEvents={onEvents} notMerge lazyUpdate style={{ height: 330, width: '100%' }} />
    </Card>
  );
}
