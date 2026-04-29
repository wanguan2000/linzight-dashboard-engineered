'use client';

import React from 'react';
import { Button, Input, Space, Tag, Tooltip } from 'antd';
import {
  ExperimentOutlined,
  FileSearchOutlined,
  FlagOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { categoryConfig, EventCategory, patientSummary } from '../data';
import { useJourneyStore } from '../store';

const categoryIcons: Record<EventCategory, React.ReactNode> = {
  disease: <FlagOutlined />,
  admission: <MedicineBoxOutlined />,
  treatment: <ThunderboltOutlined />,
  visit: <FileSearchOutlined />,
  sample: <ExperimentOutlined />,
  omics: <ExperimentOutlined />
};

export function FilterBar() {
  const enabledCategories = useJourneyStore((state) => state.enabledCategories);
  const query = useJourneyStore((state) => state.query);
  const toggleCategory = useJourneyStore((state) => state.toggleCategory);
  const setQuery = useJourneyStore((state) => state.setQuery);
  const resetView = useJourneyStore((state) => state.resetView);

  const categoryKeys = Object.keys(categoryConfig) as EventCategory[];

  return (
    <div className="filter-bar">
      <div className="patient-mini-card">
        <div className="avatar-mark">PJ</div>
        <div>
          <div className="patient-title">临床 Patient Journey</div>
          <div className="patient-subtitle">
            {patientSummary.patientId} · {patientSummary.name} · {patientSummary.sex} · {patientSummary.age}岁 · {patientSummary.diagnosis}
          </div>
        </div>
      </div>
      <Space size={8} wrap className="category-filter">
        {categoryKeys.map((category) => {
          const config = categoryConfig[category];
          const active = enabledCategories.includes(category);
          return (
            <Tag.CheckableTag
              key={category}
              checked={active}
              onChange={() => toggleCategory(category)}
              className="category-chip"
              style={
                active
                  ? {
                      color: config.color,
                      background: config.softColor,
                      borderColor: config.borderColor
                    }
                  : undefined
              }
            >
              <Space size={5}>
                {categoryIcons[category]}
                {config.label}
              </Space>
            </Tag.CheckableTag>
          );
        })}
      </Space>
      <Space size={8} className="filter-actions">
        <Input.Search
          allowClear
          className="journey-search"
          placeholder="搜索事件、样本、治疗、随访..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Tooltip title="重置缩放、筛选与选中状态">
          <Button icon={<ReloadOutlined />} onClick={resetView}>
            重置视图
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
}
