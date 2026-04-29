'use client';

import React from 'react';
import { Descriptions, Drawer, Space, Tag, Timeline, Typography } from 'antd';
import { CalendarOutlined, ExperimentOutlined, FileTextOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { findEventById } from '../data';
import { useJourneyStore } from '../store';

const { Paragraph, Title } = Typography;

export function EventDetailDrawer() {
  const selectedEventId = useJourneyStore((state) => state.selectedEventId);
  const detailOpen = useJourneyStore((state) => state.detailOpen);
  const setDetailOpen = useJourneyStore((state) => state.setDetailOpen);
  const event = findEventById(selectedEventId);

  return (
    <Drawer
      title="临床事件详情"
      open={detailOpen && !!event}
      onClose={() => setDetailOpen(false)}
      width={480}
      className="event-drawer"
      destroyOnClose
    >
      {event && (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div className="drawer-hero" style={{ borderColor: event.borderColor, background: event.softColor }}>
            <Tag color="processing" style={{ color: event.color, background: '#fff', borderColor: event.borderColor }}>
              {event.tag}
            </Tag>
            <Title level={4} style={{ margin: '10px 0 4px' }}>
              {event.title}
            </Title>
            <Paragraph style={{ margin: 0, color: '#415679' }}>{event.description}</Paragraph>
          </div>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="事件日期">{event.date}</Descriptions.Item>
            {event.kind === 'range' && <Descriptions.Item label="结束日期">{event.endDate}</Descriptions.Item>}
            <Descriptions.Item label="所属轨道">{event.track}</Descriptions.Item>
            <Descriptions.Item label="事件类型">{event.tag}</Descriptions.Item>
            <Descriptions.Item label="说明">{event.subtitle || '-'}</Descriptions.Item>
          </Descriptions>
          <div>
            <Title level={5}>关联操作建议</Title>
            <Timeline
              items={[
                {
                  dot: <CalendarOutlined />,
                  color: 'blue',
                  children: '同步查看该时间点附近的 SLEDAI、C3、ESR、24h尿蛋白与 IgG 趋势。'
                },
                {
                  dot: <FileTextOutlined />,
                  color: 'blue',
                  children: '查看门诊/住院病历、出院诊断、受累脏器与评分记录。'
                },
                {
                  dot: <MedicineBoxOutlined />,
                  color: 'green',
                  children: '核对治疗方案、用药变更、疗效评估与不良事件。'
                },
                {
                  dot: <ExperimentOutlined />,
                  color: 'purple',
                  children: '若为样本或组学事件，可跳转到样本台账与组学检测详情。'
                }
              ]}
            />
          </div>
        </Space>
      )}
    </Drawer>
  );
}
