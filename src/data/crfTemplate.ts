import sleCrfTemplateJson from '../../resource/sle-crf-v0.1.schema.json';

export type CrfFieldType = 'text' | 'number' | 'select' | 'boolean';

export interface CrfTemplateField {
  id: string;
  name: string;
  sourceName: string;
  sourceColumn: number;
  type: CrfFieldType;
}

export interface CrfTemplateSection {
  id: string;
  title: string;
  fields: CrfTemplateField[];
}

export interface CrfTemplate {
  version: string;
  name: string;
  source: string;
  releasedAt: string;
  fieldCount: number;
  notes: string[];
  sections: CrfTemplateSection[];
  exampleRows: Array<{
    row: number;
    values: Record<string, string>;
  }>;
}

export const sleCrfTemplate = sleCrfTemplateJson as CrfTemplate;

export const crfTemplateVersion = sleCrfTemplate.version;
export const crfTemplateReleasedAt = sleCrfTemplate.releasedAt;
export const crfTemplateFieldCount = sleCrfTemplate.fieldCount;

export const clinicalDataGroups = sleCrfTemplate.sections.map((section) => ({
  title: section.title,
  fields: section.fields.map((field) => field.name)
}));

export const clinicalFields = clinicalDataGroups.flatMap((section) => section.fields);

export const crfFieldDefaults = Object.fromEntries(
  sleCrfTemplate.exampleRows.flatMap((row) => Object.entries(row.values))
) as Record<string, string>;

export const systemCrfFields = sleCrfTemplate.sections.flatMap((section) =>
  section.fields.map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type === 'number' ? 'Number' : field.type === 'select' ? 'Dropdown' : field.type === 'boolean' ? 'Boolean' : 'Text',
    module: section.title,
    updatedAt: crfTemplateReleasedAt,
    status: '启用' as const
  }))
);
