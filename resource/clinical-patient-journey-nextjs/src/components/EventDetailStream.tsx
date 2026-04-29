'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import {
  ArrowRightOutlined,
  ExperimentOutlined,
  FlagOutlined,
  ThunderboltOutlined,
  MedicineBoxOutlined,
  NodeIndexOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { allStreamEvents, eventStreamOrder, JourneyEvent } from '../data';
import { useJourneyStore } from '../store';

const { Text } = Typography;

function getCategoryIcon(category: JourneyEvent['category']) {
  const iconMap = {
    disease: <FlagOutlined />,
    admission: <MedicineBoxOutlined />,
    treatment: <ThunderboltOutlined />,
    visit: <NodeIndexOutlined />,
    sample: <ExperimentOutlined />,
    omics: <ExperimentOutlined />
  } as const;
  return iconMap[category];
}

function getOrderedEvents() {
  const byId = new Map(allStreamEvents.map((event) => [event.id, event]));
  const ordered = eventStreamOrder.map((id) => byId.get(id)).filter(Boolean) as JourneyEvent[];
  const rest = allStreamEvents.filter((event) => !eventStreamOrder.includes(event.id));
  return [...ordered, ...rest].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function EventDetailStream() {
  const selectedEventId = useJourneyStore((state) => state.selectedEventId);
  const hoveredEventId = useJourneyStore((state) => state.hoveredEventId);
  const enabledCategories = useJourneyStore((state) => state.enabledCategories);
  const query = useJourneyStore((state) => state.query);
  const bindScroll = useJourneyStore((state) => state.bindScroll);
  const bidirectionalHighlight = useJourneyStore((state) => state.bidirectionalHighlight);
  const setSelectedEvent = useJourneyStore((state) => state.setSelectedEvent);
  const setHoveredEvent = useJourneyStore((state) => state.setHoveredEvent);
  const setBindScroll = useJourneyStore((state) => state.setBindScroll);
  const setBidirectionalHighlight = useJourneyStore((state) => state.setBidirectionalHighlight);
  const setDetailOpen = useJourneyStore((state) => state.setDetailOpen);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [visibleCount, setVisibleCount] = useState(8);

  const streamEvents = useMemo(() => {
    const key = query.trim().toLowerCase();
    return getOrderedEvents().filter((event) => {
      const categoryOK = enabledCategories.includes(event.category);
      const queryOK = !key || `${event.title}${event.subtitle}${event.description}${event.tag}`.toLowerCase().includes(key);
      return categoryOK && queryOK;
    });
  }, [enabledCategories, query]);

  useEffect(() => {
    setVisibleCount(8);
  }, [enabledCategories, query]);

  useEffect(() => {
    if (!selectedEventId) return;
    const index = streamEvents.findIndex((event) => event.id === selectedEventId);
    if (index >= visibleCount) setVisibleCount(index + 1);
  }, [selectedEventId, streamEvents, visibleCount]);

  useEffect(() => {
    if (!bindScroll || !selectedEventId) return;
    const el = itemRefs.current[selectedEventId];
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [bindScroll, selectedEventId]);

  return (
    <Card
      className="journey-card event-stream-card"
      title={
        <Space size={8}>
          <span>事件明细流</span>
          <span className="title-separator">|</span>
          <Text className="title-en">Event Detail Stream</Text>
        </Space>
      }
      extra={
        <Space size={12}>
          <Tooltip title="鼠标悬停右侧事件时，同步高亮左侧图表事件">
            <Space size={4} className="stream-switch">
              <SyncOutlined />
              <span>双向高亮</span>
              <Switch size="small" checked={bidirectionalHighlight} onChange={setBidirectionalHighlight} />
            </Space>
          </Tooltip>
          <Tooltip title="选中图表事件后，右侧列表自动滚动到对应事件">
            <Space size={4} className="stream-switch">
              <span>滚动绑定</span>
              <Switch size="small" checked={bindScroll} onChange={setBindScroll} />
            </Space>
          </Tooltip>
        </Space>
      }
    >
      <div className="stream-list">
        {streamEvents.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配事件" />}
        {streamEvents.slice(0, visibleCount).map((event) => {
          const active = selectedEventId === event.id;
          const hoverActive = hoveredEventId === event.id;
          return (
            <div
              key={event.id}
              ref={(node) => {
                itemRefs.current[event.id] = node;
              }}
              className={`stream-item ${active ? 'is-active' : ''} ${hoverActive ? 'is-hovered' : ''}`}
              onClick={() => {
                setSelectedEvent(event.id, event.date);
                setDetailOpen(true);
              }}
              onMouseEnter={() => bidirectionalHighlight && setHoveredEvent(event.id)}
              onMouseLeave={() => bidirectionalHighlight && setHoveredEvent(null)}
            >
              <div className="stream-left">
                <div className="stream-date">{event.date}</div>
                <div className="stream-icon" style={{ color: event.color, background: event.softColor, borderColor: event.borderColor }}>
                  {getCategoryIcon(event.category)}
                </div>
              </div>
              <div className="stream-body">
                <Space size={8} className="stream-title-line">
                  <Tag color="processing" style={{ color: event.color, background: event.softColor, borderColor: event.borderColor }}>
                    {event.tag}
                  </Tag>
                  <strong>{event.title}</strong>
                </Space>
                <div className="stream-description">{event.description}</div>
              </div>
              <ArrowRightOutlined className="stream-arrow" />
            </div>
          );
        })}
      </div>
      <div className="stream-more">
        <Button type="link" disabled={visibleCount >= streamEvents.length} onClick={() => setVisibleCount((count) => count + 5)}>
          {visibleCount >= streamEvents.length ? '已显示全部' : '加载更多'}
        </Button>
      </div>
    </Card>
  );
}
