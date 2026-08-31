"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Eye, 
  Sparkles, 
  ImageIcon, 
  Layers, 
  Check, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Type,
  FileText,
  Trash2,
  Plus,
  Inbox,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { 
  DEFAULT_HERO_SETTINGS, 
  HeroSettings, 
  PRESET_HERO_BG_IMAGES 
} from "@/data/heroSettings";
import { 
  getStoredHeroSettings, 
  saveStoredHeroSettings, 
  syncHeroSettingsFromFirestore,
  subscribeToHeroSettings,
  getStoredHeroPresets,
  saveStoredHeroPresets,
  syncHeroPresetsFromFirestore
} from "@/lib/heroStore";

export default function AdminHeroSettingsPage() {
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [presets, setPresets] = useState(PRESET_HERO_BG_IMAGES);
  const [isSaved, setIsSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState(0);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  useEffect(() => {
    setSettings(getStoredHeroSettings());
    setPresets(getStoredHeroPresets());

    syncHeroSettingsFromFirestore().then((res) => {
      if (res) setSettings(res);
    });

    syncHeroPresetsFromFirestore().then((res) => {
      if (res) setPresets(res);
    });

    const unsubHero = subscribeToHeroSettings((cloudHero) => {
      if (cloudHero) setSettings(cloudHero);
    });

    const handleUpdate = () => {
      setSettings(getStoredHeroSettings());
      setPresets(getStoredHeroPresets());
    };

    window.addEventListener("src_hero_updated", handleUpdate);
    window.addEventListener("src_hero_presets_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubHero();
      window.removeEventListener("src_hero_updated", handleUpdate);
      window.removeEventListener("src_hero_presets_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const saveAndBroadcast = (newSettings: HeroSettings) => {
    setSettings(newSettings);
    saveStoredHeroSettings(newSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleUpdate = (field: keyof HeroSettings, value: string) => {
    const updated = {
      ...settings,
      [field]: value,
    };
    saveAndBroadcast(updated);
  };

  const handleSelectPreset = (preset: { name: string; url: string; category: string }) => {
    const updated: HeroSettings = {
      ...settings,
      bgImageUrl: preset.url,
      bgTitle: preset.name,
      bgTag: preset.category,
    };
    saveAndBroadcast(updated);
    showNotice(`Activated backdrop: "${preset.name}".`);
  };

  const handleDeletePreset = (e: React.MouseEvent, presetToDelete: { name: string; url: string; category: string }) => {
    e.stopPropagation();
    const updatedPresets = presets.filter((p) => p.url !== presetToDelete.url);
    setPresets(updatedPresets);
    try {
      localStorage.setItem("src_hero_presets", JSON.stringify(updatedPresets));
    } catch (err) {
      console.error("Failed to persist presets", err);
    }

    // If the active background was this deleted image, immediately switch to the next preset or council photo!
    if (settings.bgImageUrl === presetToDelete.url) {
      const fallbackPreset = updatedPresets[0] || {
        name: "SRC Student Council Inauguration Squad",
        url: "/images/DSC_8361.JPG",
        category: "Council Assembly",
      };
      const updatedSettings: HeroSettings = {
        ...settings,
        bgImageUrl: fallbackPreset.url,
        bgTitle: fallbackPreset.name,
        bgTag: fallbackPreset.category,
      };
      saveAndBroadcast(updatedSettings);
    }

    showNotice(`Deleted preset "${presetToDelete.name}".`);
  };

  const handleAddCurrentAsPreset = () => {
    if (!settings.bgImageUrl) return;
    const exists = presets.some((p) => p.url === settings.bgImageUrl);
    if (exists) {
      showNotice("This backdrop is already saved in your presets.");
      return;
    }
    const newPreset = {
      name: settings.bgTitle || "Custom Campus Backdrop",
      url: settings.bgImageUrl,
      category: settings.bgTag || "Custom Preset",
    };
    const updated = [newPreset, ...presets];
    setPresets(updated);
    try {
      localStorage.setItem("src_hero_presets", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save preset", err);
    }
    showNotice(`Added current backdrop to presets gallery.`);
  };

  const handleResetPresets = () => {
    setPresets(PRESET_HERO_BG_IMAGES);
    try {
      localStorage.setItem("src_hero_presets", JSON.stringify(PRESET_HERO_BG_IMAGES));
    } catch (err) {
      console.error("Failed to reset presets", err);
    }
    showNotice("Restored default landmark presets.");
  };

  const handleResetAll = () => {
    if (confirm("Reset hero background and texts to default values?")) {
      setSettings(DEFAULT_HERO_SETTINGS);
      localStorage.removeItem("src_hero_settings");
      window.dispatchEvent(new CustomEvent("src_hero_updated", { detail: DEFAULT_HERO_SETTINGS }));
      showNotice("Hero settings reset to defaults.");
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight font-heading">
              HERO STUDIO & TYPOGRAPHY
            </h1>
            <Badge variant="orange" size="sm">
              LIVE CUSTOMIZER
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Customize the 100vh background image and the 3 hero motto texts. All edits apply live to the landing page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <Link
            href="/"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Landing Page</span>
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Live Hero Preview Card & Upload Box (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Live Hero Mockup Display */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Live Viewport Simulation (100vh)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {settings.bgTag}
              </span>
            </div>

            {/* Viewport Frame */}
            <div className="relative aspect-16/9 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex flex-col justify-center items-center text-center p-6 select-none group">
              
              {/* Background Image */}
              <Image
                src={settings.bgImageUrl}
                alt={settings.bgTitle}
                fill
                className="object-cover transition-all duration-700 brightness-[0.75]"
                priority
              />

              {/* Fog & Vignette Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
              <div className="absolute inset-0 bg- radial-gradient pointer-events-none" />

              {/* Foreground Typography Mockup */}
              <div className="relative z-10 space-y-2 max-w-md">
                <p className="font-heading font-extrabold text-[10px] sm:text-xs tracking-[0.25em] text-white uppercase drop-shadow-md">
                  {settings.heroOverline || "UNITED BY PURPOSE."}
                </p>
                <h2 className="font-hero font-extrabold text-2xl sm:text-4xl text-white tracking-tight leading-none drop-shadow-lg">
                  {settings.heroHeadline || "DRIVEN BY IMPACT."}
                </h2>
                <p className="font-serif italic text-xs sm:text-sm text-amber-200/90 drop-shadow-md">
                  {settings.heroTagline || "Leading today. Inspiring tomorrow."}
                </p>

                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-mono text-white/90 border border-white/30 tracking-widest uppercase">
                    {settings.tickerText || "Who ARE WE SRC!"}
                  </span>
                </div>
              </div>

              {/* Bottom tag indicator */}
              <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-slate-200 font-mono flex items-center gap-1.5 border border-white/10">
                <Sparkles className="w-3 h-3 text-[#E78023]" />
                <span>{settings.bgTitle}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium text-center">
              Active Backdrop: <strong className="text-slate-800">{settings.bgTitle}</strong>
            </p>
          </div>

          {/* Upload Custom Backdrop Dropzone */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="space-y-1 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#17458F]" />
                <span>Upload Custom Backdrop (Auto-Compressed WebP)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Upload any DSLR or phone photo. The browser automatically compresses it to a crisp, high-res WebP.
              </p>
            </div>

            <ImageUploadDropzone
              label="Drop Campus Backdrop Here"
              sublabel="Auto-converts DSLR photos to lightweight WebP"
              storagePath="hero"
              previewUrl={settings.bgImageUrl}
              onUploadStateChange={handleUploadStateChange}
              onUrlChange={(cloudUrl) => {
                if (cloudUrl) {
                  setSettings((prev) => {
                    const updated: HeroSettings = {
                      ...prev,
                      bgImageUrl: cloudUrl,
                      bgTitle: "Custom Uploaded Campus Backdrop",
                      bgTag: "Custom Upload",
                    };
                    saveAndBroadcast(updated);
                    return updated;
                  });
                  showNotice("Custom backdrop uploaded and set as active.");
                }
              }}
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAddCurrentAsPreset}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Save Current Photo to Presets Gallery</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Hero Texts & Background Presets (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. HERO 3 TEXTS EDITABLE CARD */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="space-y-1 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                  HERO COPYWRITING
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  The 3 Hero Mottos
                </h3>
              </div>
              <Type className="w-4 h-4 text-[#17458F]" />
            </div>

            {/* Text 1: Overline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                1. Top Motto Overline
              </label>
              <input
                type="text"
                value={settings.heroOverline || ""}
                onChange={(e) => handleUpdate("heroOverline", e.target.value)}
                placeholder="e.g. UNITED BY PURPOSE."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Text 2: Main Headline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                2. Main Bold Headline
              </label>
              <input
                type="text"
                value={settings.heroHeadline || ""}
                onChange={(e) => handleUpdate("heroHeadline", e.target.value)}
                placeholder="e.g. DRIVEN BY IMPACT."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Text 3: Sub-tagline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                3. Sub-tagline / Mission Motto
              </label>
              <input
                type="text"
                value={settings.heroTagline || ""}
                onChange={(e) => handleUpdate("heroTagline", e.target.value)}
                placeholder="e.g. Leading today. Inspiring tomorrow."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium italic text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Optional Text 4: Bottom Ticker */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">
                4. Bottom Ribbon Ticker
              </label>
              <input
                type="text"
                value={settings.tickerText || ""}
                onChange={(e) => handleUpdate("tickerText", e.target.value)}
                placeholder="e.g. FLAGSHIP FEST: PRARAMBH • SAHASTRADEEP"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>
          </div>

          {/* 2. BACKGROUND PRESETS & DETAILS */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                  BACKDROP IMAGE
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  Campus Landmark Presets ({presets.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleResetPresets}
                className="text-[11px] font-semibold text-slate-500 hover:text-[#17458F] transition-colors cursor-pointer"
                title="Restore default presets"
              >
                Reset Presets
              </button>
            </div>

            {/* 1-Click Campus Presets Grid with Delete Controls */}
            {presets.length === 0 ? (
              <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="mx-auto h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500">
                  All preset chips deleted. You can upload custom backdrops or restore defaults.
                </p>
                <button
                  type="button"
                  onClick={handleResetPresets}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Restore 6 Default Presets
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {presets.map((preset, i) => {
                  const isSelected = settings.bgImageUrl === preset.url;

                  return (
                    <div
                      key={preset.url || i}
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative aspect-4/3 rounded-2xl overflow-hidden border-2 text-left transition-all p-2 flex flex-col justify-end group cursor-pointer ${
                        isSelected
                          ? "border-[#E78023] ring-2 ring-[#E78023]/25 shadow-md scale-[1.02]"
                          : "border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={preset.url}
                        alt={preset.name}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                      
                      {/* Delete Preset Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(e, preset)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-all z-20 shadow-xs cursor-pointer"
                        title={`Delete preset "${preset.name}"`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 h-4 w-4 rounded-full bg-[#E78023] text-white flex items-center justify-center text-[10px] shadow-xs z-10">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      <div className="relative z-10 space-y-0.5 pr-2">
                        <p className="font-bold text-[10px] text-white line-clamp-1 leading-tight">
                          {preset.name}
                        </p>
                        <span className="text-[8px] text-amber-300 font-semibold uppercase tracking-wider block">
                          {preset.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Direct Image URL input */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">
                Direct Image Source URL
              </label>
              <input
                type="text"
                value={settings.bgImageUrl}
                onChange={(e) => handleUpdate("bgImageUrl", e.target.value)}
                placeholder="https://... or /images/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
