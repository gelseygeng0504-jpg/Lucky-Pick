'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ClipboardPaste, Plus, RotateCcw, Save, Sparkles, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const INITIAL_OPTIONS = ['Alice', 'Ben', 'Chloe', 'Daniel', 'Emma', 'Felix'];
const THEMES = [
  {
    id: 'lavender', name: 'Lavender', image: '/theme-backgrounds/lavender-field.webp?v=2',
    position: 'center 10%', accent: '#3B328C', hover: '#6B55A9', soft: '#F0EAF8', border: '#D7C9EA',
    colors: ['#3B328C', '#4E3282', '#8E6CBB', '#B69CD2', '#A2CDF3', '#F8C7CE', '#FAE6D6'],
  },
  {
    id: 'harbor', name: 'Harbor', image: '/theme-backgrounds/sunny-harbor.webp?v=2',
    position: 'center 22%', accent: '#BD161B', hover: '#E6401E', soft: '#FFF0E5', border: '#F3C5AC',
    colors: ['#BD161B', '#F2350E', '#FC7D03', '#F2928A', '#E7C96E', '#FCE3B3', '#9FD8DE'],
  },
  {
    id: 'coral', name: 'Coral', image: '/theme-backgrounds/coral-garden.webp?v=2',
    position: 'center 25%', accent: '#A81C14', hover: '#D6403C', soft: '#FFF0EF', border: '#EFBEB9',
    colors: ['#541719', '#A81C14', '#DA1A11', '#E86268', '#EEAF9A', '#91C8D3', '#C5DEDC'],
  },
  {
    id: 'alpine', name: 'Alpine', image: '/theme-backgrounds/alpine-lake.webp?v=2',
    position: 'center 15%', accent: '#15347B', hover: '#1E7BD3', soft: '#EAF3FC', border: '#BED7EF',
    colors: ['#15347B', '#1543AC', '#255DBA', '#1E7BD3', '#4FA9EB', '#A8D8F9', '#D0EFF5'],
  },
] as const;
type ThemeId = (typeof THEMES)[number]['id'];
const DEFAULT_CLASS_THEMES: ThemeId[] = ['lavender', 'harbor', 'coral'];
const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = 177;
const MAX_OPTIONS = 60;
const STORAGE_KEY = 'lucky-wheel-class-lists-v1';
const THEME_STORAGE_KEY = 'lucky-wheel-class-themes-v1';
const CLASS_NAMES = ['Class 1', 'Class 2', 'Class 3'];

type SavedClass = {
  name: string;
  students: string[];
};

const EMPTY_CLASSES: SavedClass[] = CLASS_NAMES.map((name) => ({ name, students: [] }));

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: () => Promise<{ result: string }>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function polarPoint(angle: number, radius = RADIUS) {
  const radian = ((angle - 90) * Math.PI) / 180;
  return {
    x: Number((CENTER + radius * Math.cos(radian)).toFixed(6)),
    y: Number((CENTER + radius * Math.sin(radian)).toFixed(6)),
  };
}

function segmentPath(index: number, count: number) {
  const step = 360 / count;
  const start = polarPoint(index * step - step / 2);
  const end = polarPoint(index * step + step / 2);
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${step > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
}

function entryColor(index: number, count: number, palette: readonly string[]) {
  const paletteIndex = index % palette.length;
  // Keep the first and last slices distinct when the palette wraps exactly at the seam.
  return palette[index === count - 1 && paletteIndex === 0 && count > palette.length ? 3 : paletteIndex];
}

function entryTextColor(color: string) {
  const channels = color.slice(1).match(/.{2}/g)?.map((hex) => parseInt(hex, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const darkInkContrast = (luminance + 0.05) / 0.056;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast > darkInkContrast ? '#ffffff' : '#0c1420';
}

export default function Home() {
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [classLists, setClassLists] = useState<SavedClass[]>(EMPTY_CLASSES);
  const [activeClass, setActiveClass] = useState(0);
  const [classThemes, setClassThemes] = useState<ThemeId[]>(DEFAULT_CLASS_THEMES);
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const rotationRef = useRef(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wheelItems = useMemo(
    () => options.map((item, index) => item.trim() || `Student ${index + 1}`),
    [options],
  );
  const activeTheme = THEMES.find((theme) => theme.id === classThemes[activeClass]) ?? THEMES[0];
  const wheelPalette = activeTheme.colors;
  const themeStyle = {
    '--theme-accent': activeTheme.accent,
    '--theme-hover': activeTheme.hover,
    '--theme-soft': activeTheme.soft,
    '--theme-border': activeTheme.border,
    '--theme-image': `url(${activeTheme.image})`,
    '--theme-position': activeTheme.position,
  } as CSSProperties;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as SavedClass[];
      if (Array.isArray(parsed) && parsed.length === 3) {
        setClassLists(parsed.map((item, index) => ({
          name: CLASS_NAMES[index],
          students: Array.isArray(item.students) ? item.students.slice(0, MAX_OPTIONS) : [],
        })));
      }
    } catch {
      setSaveStatus('Could not load saved lists. Please save them again.');
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== CLASS_NAMES.length) return;
      setClassThemes(parsed.map((id, index) =>
        THEMES.some((theme) => theme.id === id) ? id as ThemeId : DEFAULT_CLASS_THEMES[index],
      ));
    } catch {
      setSaveStatus('Could not load saved themes.');
    }
  }, []);

  const selectTheme = (themeId: ThemeId) => {
    if (isSpinning) return;
    const next = classThemes.map((id, index) => index === activeClass ? themeId : id);
    setClassThemes(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
    } catch {
      setSaveStatus('Could not save this theme on your device.');
    }
  };

  const updateOption = (index: number, value: string) => {
    setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    setResult(null);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((current) => [...current, '']);
    setResult(null);
  };

  const loadClass = (index: number) => {
    if (isSpinning) return;
    setActiveClass(index);
    const students = classLists[index].students;
    if (students.length >= 2) {
      setOptions(students);
      setResult(null);
      setSaveStatus(`Loaded ${classLists[index].name} · ${students.length} students`);
    } else {
      setSaveStatus(`${classLists[index].name} is empty. Save the current list here.`);
    }
  };

  const saveCurrentClass = () => {
    const students = options.map((item) => item.trim()).filter(Boolean).slice(0, MAX_OPTIONS);
    if (students.length < 2) {
      setSaveStatus('Add at least 2 students before saving.');
      return;
    }
    const next = classLists.map((item, index) => index === activeClass ? { ...item, students } : item);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setClassLists(next);
      setSaveStatus(`Saved to ${next[activeClass].name} · ${students.length} students`);
    } catch {
      setSaveStatus('Could not save. Check your browser storage settings.');
    }
  };

  const openImporter = () => {
    setImportText(options.join('\n'));
    setImportOpen(true);
  };

  const applyImportedList = () => {
    const students = importText
      .split(/[\n,，、;；\t]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_OPTIONS);
    if (students.length < 2) {
      setSaveStatus('Enter at least 2 students.');
      return;
    }
    setOptions(students);
    setResult(null);
    setImportOpen(false);
    setSaveStatus(`Imported ${students.length} students. Save the list to a class when ready.`);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setResult(null);
  };

  const reset = () => {
    if (isSpinning) return;
    setOptions(INITIAL_OPTIONS);
    setResult(null);
    rotationRef.current = 0;
    setRotation(0);
  };

  const spin = useCallback(() => {
    if (isSpinning || wheelItems.length < 2) return Promise.reject(new Error('The wheel is already spinning. Please wait.'));
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const winnerIndex = randomBuffer[0] % wheelItems.length;
    const segmentAngle = 360 / wheelItems.length;
    const current = rotationRef.current;
    const normalized = ((current % 360) + 360) % 360;
    const destination = (360 - winnerIndex * segmentAngle) % 360;
    const adjustment = (destination - normalized + 360) % 360;
    const nextRotation = current + 360 * 6 + adjustment;

    setResult(null);
    setIsSpinning(true);
    rotationRef.current = nextRotation;
    setRotation(nextRotation);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    return new Promise<string>((resolve) => {
      finishTimer.current = setTimeout(() => {
        const winner = wheelItems[winnerIndex];
        setIsSpinning(false);
        setResult(winner);
        resolve(winner);
      }, 4400);
    });
  }, [isSpinning, wheelItems]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'spin_wheel',
        title: 'Spin the wheel',
        description: 'Spin the wheel on this page, wait for it to stop, and return the selected student.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute() {
          const winner = await spin();
          return { result: winner };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {
      // Older browsers do not expose the optional WebMCP registry.
    }
    return () => lifecycle.abort();
  }, [spin]);

  return (
    <main className="app-shell has-theme" style={themeStyle}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><Sparkles size={18} /></div>
        <div>
          <h1>Lucky Pick</h1>
          <p className="eyebrow">Let chance make the call</p>
        </div>
        <button className="reset-button" onClick={reset} disabled={isSpinning} aria-label="Reset to the default list">
          <RotateCcw size={16} /><span>Reset</span>
        </button>
      </header>

      <section className="workspace">
        <div className="wheel-stage">
          <div className="stage-heading">
            <span>LUCKY WHEEL</span>
            <span>{wheelItems.length} ENTRIES</span>
          </div>
          <div className={`result-card ${result ? 'is-visible' : ''}`} aria-live="polite">
            <span>{result ? 'WINNER' : isSpinning ? 'PICKING' : 'READY'}</span>
            <strong>{result ?? (isSpinning ? 'Choosing a student…' : 'Ready to pick')}</strong>
          </div>

          <div className="wheel-wrap">
            <div className="pointer" aria-hidden="true"><span /></div>
            <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }} aria-label={`Wheel with ${wheelItems.length} entries`}>
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                {wheelItems.map((item, index) => {
                  const segmentColor = entryColor(index, wheelItems.length, wheelPalette);
                  const labelColor = entryTextColor(segmentColor);
                  const isLargeClass = wheelItems.length > 12;
                  const segmentAngle = 360 / wheelItems.length;
                  const angle = index * segmentAngle;
                  const labelSize = isLargeClass ? (wheelItems.length > 40 ? 6.4 : 8.6) : 13;
                  const labelRadius = wheelItems.length > 40 ? 136 : 132;
                  const verticalName = Array.from(item).slice(0, 5);
                  const characterSpacing = wheelItems.length > 40 ? 6.7 : 9.1;
                  const labelLaneWidth = labelSize + 4.5;
                  const oneMillimeter = 3.78;
                  const edgeInsetAngle = Math.min(
                    ((oneMillimeter + labelLaneWidth / 2) / labelRadius) * (180 / Math.PI),
                    segmentAngle * 0.42,
                  );
                  const labelAngle = angle + segmentAngle / 2 - edgeInsetAngle;
                  const labelPoint = polarPoint(angle, wheelItems.length > 8 ? 105 : 112);
                  const outerCharacterRadius = labelRadius + ((verticalName.length - 1) / 2) * characterSpacing;
                  const maxLabelLength = 7;
                  return (
                    <g key={`${index}-${item}`}>
                      <path
                        d={segmentPath(index, wheelItems.length)}
                        fill={segmentColor}
                        stroke={segmentColor}
                        strokeWidth="0.8"
                      />
                      {isLargeClass ? (
                        <g>
                          {verticalName.map((character, characterIndex) => {
                            const characterRadius = outerCharacterRadius - characterIndex * characterSpacing;
                            const characterPoint = polarPoint(labelAngle, characterRadius);
                            return (
                              <text
                                key={`${character}-${characterIndex}`}
                                x={characterPoint.x}
                                y={characterPoint.y}
                                fill={labelColor}
                                fontSize={labelSize}
                                fontWeight="720"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{
                                  transform: `rotate(${-rotation}deg)`,
                                  transformBox: 'fill-box',
                                  transformOrigin: 'center',
                                  transition: 'transform 4.4s cubic-bezier(.12,.72,.08,1)',
                                }}
                              >
                                {character}
                              </text>
                            );
                          })}
                        </g>
                      ) : (
                        <text
                          x={labelPoint.x} y={labelPoint.y} fill={labelColor}
                          fontSize={labelSize} fontWeight="800"
                          textAnchor="middle" dominantBaseline="middle"
                          style={{
                            transform: `rotate(${-rotation}deg)`,
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                            transition: 'transform 4.4s cubic-bezier(.12,.72,.08,1)',
                          }}
                        >
                          {item.length > maxLabelLength ? `${item.slice(0, maxLabelLength)}…` : item}
                        </text>
                      )}
                    </g>
                  );
                })}
                <circle cx={CENTER} cy={CENTER} r="24" fill="#ffffff" />
                <circle cx={CENTER} cy={CENTER} r="11" fill="#3157ff" />
              </svg>
            </div>
            <button className="spin-button" onClick={() => void spin()} disabled={isSpinning}>
              <span>{isSpinning ? 'Spinning' : 'Spin'}</span><small>GO</small>
            </button>
          </div>
          <p className="hint"><span />Every student has an equal chance</p>
        </div>

        <aside className="editor-card">
          <div className="editor-heading">
            <div><p className="eyebrow">EDIT LIST</p><h2>Wheel entries</h2></div>
            <span className="count-badge">{options.length}/{MAX_OPTIONS}</span>
          </div>

          <div className="class-library">
            <div className="class-library-title"><Users size={15} />Saved classes</div>
            <div className="class-tabs" role="group" aria-label="Saved class lists">
              {classLists.map((item, index) => (
                <button
                  key={item.name}
                  className={`class-tab ${activeClass === index ? 'is-active' : ''}`}
                  onClick={() => loadClass(index)}
                  disabled={isSpinning}
                >
                  <strong>{item.name}</strong>
                  <small>{item.students.length ? `${item.students.length} students` : 'Not saved'}</small>
                </button>
              ))}
            </div>
            <button className="save-class-button" onClick={saveCurrentClass} disabled={isSpinning}>
              <Save size={15} />Save current list to {classLists[activeClass].name}
            </button>
            {saveStatus && <p className="save-status" role="status">{saveStatus}</p>}
          </div>

          <div className="theme-picker">
            <div className="theme-picker-heading">
              <span>Artwork</span>
              <small>For {classLists[activeClass].name}</small>
            </div>
            <div className="theme-options" role="group" aria-label={`Artwork for ${classLists[activeClass].name}`}>
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option ${activeTheme.id === theme.id ? 'is-active' : ''}`}
                  onClick={() => selectTheme(theme.id)}
                  aria-pressed={activeTheme.id === theme.id}
                  disabled={isSpinning}
                >
                  <span className="theme-option-image" style={{ backgroundImage: `url(${theme.image})` }} />
                  <span className="theme-option-name">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="list-toolbar">
            <span>Student list</span>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger className="batch-button" onClick={openImporter}>
                <ClipboardPaste size={15} />Paste list
              </DialogTrigger>
              <DialogContent className="import-dialog">
                <DialogHeader>
                  <DialogTitle>Paste a student list</DialogTitle>
                  <DialogDescription>Enter one student per line, or separate names with commas. Up to {MAX_OPTIONS} students.</DialogDescription>
                </DialogHeader>
                <Textarea
                  className="import-textarea"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={'Alex Morgan\nJamie Lee\nTaylor Kim'}
                  autoFocus
                />
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button onClick={applyImportedList}>Apply list</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="option-list">
            {options.map((option, index) => (
              <div className="option-row" key={index}>
                <span
                  className="entry-index"
                  style={{
                    backgroundColor: entryColor(index, options.length, wheelPalette),
                    color: entryTextColor(entryColor(index, options.length, wheelPalette)),
                  }}
                >{index + 1}</span>
                <Input value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Student ${index + 1}`} maxLength={20} aria-label={`Student ${index + 1}`} disabled={isSpinning} />
                <button className="delete-button" onClick={() => removeOption(index)} disabled={options.length <= 2 || isSpinning} aria-label={`Delete student ${index + 1}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button className="add-button" variant="outline" onClick={addOption} disabled={options.length >= MAX_OPTIONS || isSpinning}>
            <Plus size={17} />Add student
          </Button>
          <p className="editor-note">2–{MAX_OPTIONS} students · Saved only on this device</p>
        </aside>
      </section>
    </main>
  );
}
