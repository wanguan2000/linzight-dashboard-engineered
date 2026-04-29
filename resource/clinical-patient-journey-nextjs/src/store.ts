import { create } from 'zustand';
import { EventCategory } from './data';

export interface ZoomState {
  start: number;
  end: number;
}

interface JourneyState {
  selectedEventId: string | null;
  selectedDate: string;
  hoveredEventId: string | null;
  zoom: ZoomState;
  enabledCategories: EventCategory[];
  query: string;
  bindScroll: boolean;
  bidirectionalHighlight: boolean;
  detailOpen: boolean;
  setSelectedEvent: (id: string | null, date?: string) => void;
  setHoveredEvent: (id: string | null) => void;
  setZoom: (zoom: ZoomState) => void;
  toggleCategory: (category: EventCategory) => void;
  setQuery: (query: string) => void;
  resetView: () => void;
  setBindScroll: (value: boolean) => void;
  setBidirectionalHighlight: (value: boolean) => void;
  setDetailOpen: (value: boolean) => void;
}

const defaultCategories: EventCategory[] = ['disease', 'admission', 'treatment', 'visit', 'sample', 'omics'];

export const useJourneyStore = create<JourneyState>((set, get) => ({
  selectedEventId: 'evt-v2',
  selectedDate: '2024-06-01',
  hoveredEventId: null,
  zoom: { start: 0, end: 100 },
  enabledCategories: defaultCategories,
  query: '',
  bindScroll: true,
  bidirectionalHighlight: true,
  detailOpen: false,
  setSelectedEvent: (id, date) => set({ selectedEventId: id, selectedDate: date ?? get().selectedDate }),
  setHoveredEvent: (id) => set({ hoveredEventId: id }),
  setZoom: (zoom) => set({ zoom }),
  toggleCategory: (category) => {
    const current = get().enabledCategories;
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    set({ enabledCategories: next.length ? next : current });
  },
  setQuery: (query) => set({ query }),
  resetView: () =>
    set({
      selectedEventId: 'evt-v2',
      selectedDate: '2024-06-01',
      zoom: { start: 0, end: 100 },
      enabledCategories: defaultCategories,
      query: '',
      detailOpen: false
    }),
  setBindScroll: (value) => set({ bindScroll: value }),
  setBidirectionalHighlight: (value) => set({ bidirectionalHighlight: value }),
  setDetailOpen: (value) => set({ detailOpen: value })
}));
