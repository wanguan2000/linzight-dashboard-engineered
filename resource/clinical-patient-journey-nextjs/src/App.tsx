'use client';

import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BiomarkerTrendChart } from './components/BiomarkerTrendChart';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { EventDetailStream } from './components/EventDetailStream';
import { FilterBar } from './components/FilterBar';
import { MultiTrackTimeline } from './components/MultiTrackTimeline';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2f6bff',
          colorInfo: '#2f6bff',
          borderRadius: 12,
          colorText: '#18315f',
          colorTextSecondary: '#5b6f92',
          colorBorder: '#dbe8ff',
          colorBgBase: '#f6f9ff',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
        },
        components: {
          Card: {
            headerBg: '#ffffff',
            colorBorderSecondary: '#dbe8ff'
          },
          Tag: {
            borderRadiusSM: 8
          },
          Button: {
            borderRadius: 10
          }
        }
      }}
    >
      <div className="page-shell">
        <FilterBar />
        <div className="journey-grid">
          <div className="left-column">
            <MultiTrackTimeline />
            <BiomarkerTrendChart />
          </div>
          <EventDetailStream />
        </div>
        <EventDetailDrawer />
      </div>
    </ConfigProvider>
  );
}
