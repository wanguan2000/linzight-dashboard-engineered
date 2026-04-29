'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { Badge, Card, Space, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { journeyEnd, journeyEvents, journeyStart, trackLabels } from '../data';
import { useJourneyStore } from '../store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const { Text } = Typography;

function quarterLabel(value: number | string) {
  const d = dayjs(value);
  const month = d.month();
  const quarter = Math.floor(month / 3) + 1;
  if (month === 0) return `{year|${d.year()}}\n{quarter|Q${quarter}}`;
  if ([3, 6, 9].includes(month)) return `{quarter|Q${quarter}}`;
  return '';
}

export function MultiTrackTimeline() {
  const selectedEventId = useJourneyStore((state) => state.selectedEventId);
  const selectedDate = useJourneyStore((state) => state.selectedDate);
  const hoveredEventId = useJourneyStore((state) => state.hoveredEventId);
  const zoom = useJourneyStore((state) => state.zoom);
  const enabledCategories = useJourneyStore((state) => state.enabledCategories);
  const query = useJourneyStore((state) => state.query);
  const setSelectedEvent = useJourneyStore((state) => state.setSelectedEvent);
  const setHoveredEvent = useJourneyStore((state) => state.setHoveredEvent);
  const setZoom = useJourneyStore((state) => state.setZoom);
  const setDetailOpen = useJourneyStore((state) => state.setDetailOpen);

  const visibleEvents = useMemo(() => {
    const key = query.trim().toLowerCase();
    return journeyEvents.filter((event) => {
      const categoryOK = enabledCategories.includes(event.category);
      const queryOK = !key || `${event.title}${event.subtitle}${event.description}${event.tag}`.toLowerCase().includes(key);
      return categoryOK && queryOK;
    });
  }, [enabledCategories, query]);

  const option = useMemo(() => {
    const customData = visibleEvents.map((event) => ({
      id: event.id,
      name: event.title,
      payload: event,
      value: [
        event.date,
        event.endDate ?? event.date,
        event.laneIndex,
        event.title,
        event.id,
        event.kind,
        event.color,
        event.subtitle ?? '',
        selectedEventId === event.id ? 1 : 0,
        hoveredEventId === event.id ? 1 : 0
      ]
    }));

    return {
      animationDuration: 550,
      grid: {
        left: 128,
        right: 26,
        top: 58,
        bottom: 56,
        containLabel: false
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#cfe3ff',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#1f2f55', fontSize: 12 },
        formatter: (params: any) => {
          const event = params.data?.payload;
          if (!event) return '';
          const time = event.kind === 'range' ? `${event.date} ~ ${event.endDate}` : event.date;
          return `
            <div style="font-weight:700;color:#102a63;margin-bottom:4px;">${event.title}</div>
            <div style="color:#64748b;margin-bottom:4px;">${event.track} · ${event.tag}</div>
            <div style="color:#2563eb;margin-bottom:6px;">${time}</div>
            <div style="max-width:260px;line-height:1.45;">${event.description}</div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        min: journeyStart,
        max: journeyEnd,
        position: 'top',
        splitNumber: 12,
        axisLine: { lineStyle: { color: '#dbe8ff' } },
        axisTick: { lineStyle: { color: '#dbe8ff' }, length: 10 },
        splitLine: { show: true, lineStyle: { color: '#edf3ff', type: 'solid' } },
        axisLabel: {
          color: '#465d88',
          fontSize: 12,
          fontWeight: 600,
          margin: 10,
          formatter: quarterLabel,
          rich: {
            year: { color: '#0f2b65', fontSize: 14, fontWeight: 800, lineHeight: 18 },
            quarter: { color: '#50668d', fontSize: 13, fontWeight: 700, lineHeight: 18 }
          }
        }
      },
      yAxis: {
        type: 'category',
        data: trackLabels,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: '#eaf1fb' } },
        axisLabel: {
          color: '#163768',
          fontSize: 13,
          fontWeight: 700,
          margin: 20
        }
      },
      dataZoom: [
        {
          type: 'slider',
          show: true,
          height: 26,
          bottom: 10,
          left: 130,
          right: 28,
          start: zoom.start,
          end: zoom.end,
          brushSelect: true,
          backgroundColor: '#eff6ff',
          fillerColor: 'rgba(47, 107, 255, 0.16)',
          borderColor: '#95baff',
          handleIcon:
            'path://M10,0 L14,0 L14,32 L10,32 Z M18,0 L22,0 L22,32 L18,32 Z',
          handleSize: '110%',
          handleStyle: { color: '#ffffff', borderColor: '#3b82f6', shadowBlur: 4, shadowColor: 'rgba(60,120,255,0.22)' },
          dataBackground: {
            lineStyle: { color: '#a5c3ff' },
            areaStyle: { color: '#b9d4ff' }
          },
          selectedDataBackground: {
            lineStyle: { color: '#4d83ff' },
            areaStyle: { color: '#83b2ff' }
          },
          textStyle: { color: '#58719e' }
        },
        { type: 'inside', start: zoom.start, end: zoom.end }
      ],
      series: [
        {
          type: 'custom',
          name: '临床事件',
          data: customData,
          encode: { x: [0, 1], y: 2, tooltip: [0, 1, 3] },
          renderItem: (params: any, api: any) => {
            const startDate = api.value(0);
            const endDate = api.value(1);
            const laneIndex = api.value(2);
            const title = String(api.value(3));
            const kind = String(api.value(5));
            const color = String(api.value(6));
            const subtitle = String(api.value(7));
            const isSelected = Number(api.value(8)) === 1;
            const isHovered = Number(api.value(9)) === 1;
            const start = api.coord([startDate, laneIndex]);
            const end = api.coord([endDate, laneIndex]);
            const bandHeight = api.size([0, 1])[1];
            const y = start[1];
            const opacity = isHovered || isSelected ? 1 : 0.88;

            if (kind === 'range') {
              const height = Math.max(11, Math.min(16, bandHeight * 0.18));
              const rectX = start[0];
              const rectY = y - height / 2;
              const width = Math.max(end[0] - start[0], 10);
              const clipped = echarts.graphic.clipRectByRect(
                { x: rectX, y: rectY, width, height },
                {
                  x: params.coordSys.x,
                  y: params.coordSys.y,
                  width: params.coordSys.width,
                  height: params.coordSys.height
                }
              );
              if (!clipped) return undefined;
              return {
                type: 'group',
                children: [
                  {
                    type: 'rect',
                    shape: { ...clipped, r: 7 },
                    style: {
                      fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color },
                        { offset: 1, color: isSelected ? '#7aa8ff' : color }
                      ]),
                      opacity,
                      shadowBlur: isSelected ? 12 : 5,
                      shadowColor: isSelected ? 'rgba(47,107,255,.33)' : 'rgba(42,64,102,.15)'
                    }
                  },
                  {
                    type: 'text',
                    style: {
                      text: title,
                      x: rectX + 4,
                      y: rectY - 8,
                      fill: isSelected ? '#1d4ed8' : color,
                      font: '700 12px Inter, Arial, sans-serif',
                      textShadowBlur: 2,
                      textShadowColor: '#fff'
                    }
                  },
                  {
                    type: 'text',
                    style: {
                      text: subtitle,
                      x: rectX + 4,
                      y: rectY + height + 16,
                      fill: '#526786',
                      font: '11px Inter, Arial, sans-serif'
                    }
                  }
                ]
              };
            }

            const radius = isSelected ? 9 : isHovered ? 8 : 6;
            return {
              type: 'group',
              children: [
                {
                  type: 'circle',
                  shape: { cx: start[0], cy: y, r: radius + 5 },
                  style: {
                    fill: color,
                    opacity: isSelected ? 0.18 : isHovered ? 0.14 : 0.08
                  }
                },
                {
                  type: 'circle',
                  shape: { cx: start[0], cy: y, r: radius },
                  style: {
                    fill: '#ffffff',
                    stroke: color,
                    lineWidth: isSelected ? 4 : 2.5,
                    shadowBlur: isSelected ? 12 : 4,
                    shadowColor: isSelected ? 'rgba(47,107,255,.45)' : 'rgba(42,64,102,.16)'
                  }
                },
                {
                  type: 'circle',
                  shape: { cx: start[0], cy: y, r: Math.max(2.5, radius - 4) },
                  style: { fill: color, opacity: 0.92 }
                },
                {
                  type: 'text',
                  style: {
                    text: title,
                    x: start[0] + 12,
                    y: y - 14,
                    fill: isSelected ? '#1d4ed8' : '#163768',
                    font: '700 12px Inter, Arial, sans-serif',
                    textShadowBlur: 2,
                    textShadowColor: '#fff'
                  }
                },
                {
                  type: 'text',
                  style: {
                    text: subtitle || startDate,
                    x: start[0] + 12,
                    y: y + 14,
                    fill: '#556b8e',
                    font: '11px Inter, Arial, sans-serif'
                  }
                }
              ]
            };
          }
        },
        {
          type: 'scatter',
          data: [],
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            label: {
              show: true,
              position: 'end',
              formatter: selectedDate,
              color: '#ffffff',
              backgroundColor: '#2f6bff',
              padding: [5, 8],
              borderRadius: 6,
              fontWeight: 700
            },
            lineStyle: {
              color: '#2f6bff',
              type: 'dashed',
              width: 1.5,
              opacity: 0.76
            },
            data: [{ xAxis: selectedDate }]
          }
        }
      ]
    };
  }, [hoveredEventId, selectedDate, selectedEventId, visibleEvents, zoom.end, zoom.start]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        const event = params.data?.payload;
        if (!event) return;
        setSelectedEvent(event.id, event.date);
        setDetailOpen(true);
      },
      mouseover: (params: any) => {
        const event = params.data?.payload;
        if (event) setHoveredEvent(event.id);
      },
      mouseout: () => setHoveredEvent(null),
      datazoom: (params: any) => {
        const payload = Array.isArray(params.batch) ? params.batch[0] : params;
        if (typeof payload?.start === 'number' && typeof payload?.end === 'number') {
          setZoom({ start: payload.start, end: payload.end });
        }
      }
    }),
    [setDetailOpen, setHoveredEvent, setSelectedEvent, setZoom]
  );

  return (
    <Card
      className="journey-card timeline-card"
      title={
        <Space size={8}>
          <span>多轨临床事件轴</span>
          <span className="title-separator">|</span>
          <Text className="title-en">Multi-track Event Timeline</Text>
          <Tooltip title="支持点事件、区间事件、时间缩放、事件点击、右侧明细联动">
            <InfoCircleOutlined className="title-info" />
          </Tooltip>
        </Space>
      }
      extra={<Badge count={visibleEvents.length} showZero color="#2f6bff" />}
    >
      <ReactECharts option={option} onEvents={onEvents} notMerge lazyUpdate style={{ height: 430, width: '100%' }} />
    </Card>
  );
}
