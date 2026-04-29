import { CohortOverviewCard } from './CohortOverviewCard';
import { EnrollmentTrendCard } from './EnrollmentTrendCard';
import { MetricGrid } from './MetricGrid';
import { OmicsTatCard } from './OmicsTatCard';
import { PatientJourneyCard } from './PatientJourneyCard';
import { QuickActions } from './QuickActions';
import { SmartSummaryCard } from './SmartSummaryCard';
import { WorkflowProgressCard } from './WorkflowProgressCard';
import type { PatientRecord } from '../data/patientCohort';

interface DashboardProps {
  selectedModule?: string;
  selectedPatient?: PatientRecord | null;
}

export function Dashboard({ selectedModule, selectedPatient }: DashboardProps = {}) {
  return (
    <div className="content">
      {selectedModule && (
        <section className="module-context">
          <div>
            <span>当前模块</span>
            <strong>{selectedModule}</strong>
          </div>
          {selectedPatient && <p>已定位患者：{selectedPatient.name} / 住院号 {selectedPatient.hospitalNo}</p>}
        </section>
      )}

      <MetricGrid />

      <section className="charts-grid" aria-label="看板可视化">
        <EnrollmentTrendCard />
        <PatientJourneyCard />
        <OmicsTatCard />
      </section>

      <section className="bottom-grid" aria-label="运营概览">
        <CohortOverviewCard />
        <WorkflowProgressCard />
        <SmartSummaryCard />
      </section>

      <QuickActions />
    </div>
  );
}
