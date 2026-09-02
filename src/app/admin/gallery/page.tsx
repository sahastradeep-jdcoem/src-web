"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Image as ImageIcon, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  RotateCcw, 
  CheckCircle2, 
  Filter, 
  Sparkles,
  Calendar,
  Layers,
  Tag,
  Loader2
} from "lucide-react";
import { 
  getStoredGalleryPhotos, 
  saveStoredGalleryPhotos, 
  syncGalleryFromFirestore, 
  resetGalleryToDefaults,
  subscribeToGallery
} from "@/lib/galleryStore";
import { GalleryPhoto } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";

const CATEGORIES = [
  "All",
  "Events",
  "Clubs",
  "SRC",
  "Prarambh",
  "Behind the Scenes",
  "Vibrance",
];

export default function AdminGalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  useEffect(() => {
    setPhotos(getStoredGalleryPhotos());

    syncGalleryFromFirestore().then((res) => {
      if (res) setPhotos(res);
    });

    const unsub = subscribeToGallery((cloudPhotos) => {
      if (cloudPhotos && cloudPhotos.length > 0) {
        setPhotos(cloudPhotos);
      }
    });

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setPhotos(e.detail);
      } else {
        setPhotos(getStoredGalleryPhotos());
      }
    };

    window.addEventListener("src_gallery_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsub();
      window.removeEventListener("src_gallery_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const saveList = (updated: GalleryPhoto[]) => {
    setPhotos(updated);
    saveStoredGalleryPhotos(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    setEditingPhoto({
      id: `gal-${Date.now()}`,
      title: "",
      category: "Events",
      imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      caption: "",
      aspectRatio: "landscape"
    });
  };

  const handleSavePhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;

    if (!editingPhoto.title.trim() || !editingPhoto.imageUrl.trim()) {
      alert("Please provide both a Title and an Image URL.");
      return;
    }

    let updated: GalleryPhoto[];
    if (isCreatingNew) {
      updated = [editingPhoto, ...photos];
    } else {
      updated = photos.map((p) => (p.id === editingPhoto.id ? editingPhoto : p));
    }

    saveList(updated);
    setEditingPhoto(null);
    setIsCreatingNew(false);
  };

  const handleDeletePhoto = (id: string, title: string) => {
    if (confirm(`Are you sure you want to remove "${title || "this photo"}" from the gallery?`)) {
      const updated = photos.filter((p) => p.id !== id);
      saveList(updated);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset gallery to default photographs?")) {
      const defs = resetGalleryToDefaults();
      setPhotos(defs);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const matchesSearch = 
        (p.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.caption || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [photos, searchQuery, selectedCategory]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              GALLERY & VISUAL ARCHIVES STUDIO
            </h1>
            <Badge variant="orange" size="sm">
              LIVE CURATION
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Upload, curate, tag, and publish campus photographs and visual archives displayed on the public gallery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <Button
            onClick={handleOpenAddModal}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Photograph</span>
          </Button>

          <Link
            href="/gallery"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Live /gallery Page in New Tab"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Gallery photos successfully saved and published live!</span>
          </div>
          <Link href="/gallery" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Live Public Gallery &rarr;
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Photographs</span>
          <p className="font-heading font-extrabold text-2xl text-[#17458F]">{photos.length}</p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prarambh Memories</span>
          <p className="font-heading font-extrabold text-2xl text-[#E78023]">
            {photos.filter(p => p.category === "Prarambh").length}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Events & Festivals</span>
          <p className="font-heading font-extrabold text-2xl text-emerald-600">
            {photos.filter(p => p.category === "Events" || p.category === "Vibrance").length}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clubs & Behind Scenes</span>
          <p className="font-heading font-extrabold text-2xl text-indigo-600">
            {photos.filter(p => p.category === "Clubs" || p.category === "Behind the Scenes").length}
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search photographs by title, description, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#17458F]"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredPhotos.length} of {photos.length} photographs
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#E78023]" />
            <span>Category:</span>
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#17458F] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            className="group rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between shadow-xs"
          >
            <div>
              {/* Photo Image Box */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <Image
                  src={photo.imageUrl}
                  alt={photo.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute top-2 left-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/95 text-[#E78023] border border-slate-200 shadow-xs">
                    {photo.category}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                    {photo.aspectRatio || "landscape"}
                  </span>
                </div>
              </div>

              {/* Photo Details */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                  <Calendar className="w-3 h-3 text-[#E78023]" />
                  <span>{photo.date}</span>
                </div>
                <h3 className="font-heading font-bold text-sm text-[#0F172A] line-clamp-1">
                  {photo.title}
                </h3>
                {photo.caption && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {photo.caption}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
              <button
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingPhoto(photo);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => handleDeletePhoto(photo.id, photo.title)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Delete Photograph"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredPhotos.length === 0 && (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs space-y-3">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-sm text-slate-700">No photographs matched your filter.</p>
          <Button onClick={handleOpenAddModal} variant="outline" size="sm">
            Add a photograph now
          </Button>
        </div>
      )}

      {/* Add / Edit Photograph Modal */}
      {editingPhoto && (
        <Modal
          isOpen={true}
          onClose={() => {
            setEditingPhoto(null);
            setIsCreatingNew(false);
          }}
          title={isCreatingNew ? "Add New Photograph to Gallery" : "Edit Photograph Details"}
        >
          <form onSubmit={handleSavePhoto} className="space-y-4 text-xs">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Photo Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Lighting of the Sahastradeep Lamp"
                value={editingPhoto.title}
                onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Category & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Category *</label>
                <select
                  value={editingPhoto.category}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                >
                  <option value="Events">Events</option>
                  <option value="Clubs">Clubs</option>
                  <option value="SRC">SRC</option>
                  <option value="Prarambh">Prarambh</option>
                  <option value="Vibrance">Vibrance</option>
                  <option value="Behind the Scenes">Behind the Scenes</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Date / Milestone</label>
                <input
                  type="text"
                  placeholder="e.g. 24 September 2025"
                  value={editingPhoto.date}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Display Layout Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {(["landscape", "portrait", "square"] as const).map((ratio) => (
                  <button
                    type="button"
                    key={ratio}
                    onClick={() => setEditingPhoto({ ...editingPhoto, aspectRatio: ratio })}
                    className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      editingPhoto.aspectRatio === ratio
                        ? "bg-[#17458F] text-white border-[#17458F]"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload Dropzone */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Photograph Upload / Image URL *</label>
              <ImageUploadDropzone
                label="Drop Photograph Here"
                sublabel="Raw DSLR photos are automatically optimized to crystal-clear Full HD WebP"
                storagePath="gallery"
                aspectRatio={editingPhoto.aspectRatio === "portrait" ? "3:4" : editingPhoto.aspectRatio === "square" ? "1:1" : "16:9"}
                previewUrl={editingPhoto.imageUrl}
                onUploadStateChange={handleUploadStateChange}
                onUrlChange={(url) => {
                  setEditingPhoto((prev) => (prev ? { ...prev, imageUrl: url } : null));
                }}
              />
              <input
                type="text"
                placeholder="Or paste direct image URL (https://...)"
                value={editingPhoto.imageUrl}
                onChange={(e) => setEditingPhoto((prev) => (prev ? { ...prev, imageUrl: e.target.value } : null))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Caption / Narrative</label>
              <textarea
                rows={3}
                placeholder="Describe the occasion, student participants, or milestone significance..."
                value={editingPhoto.caption || ""}
                onChange={(e) => setEditingPhoto((prev) => (prev ? { ...prev, caption: e.target.value } : null))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingPhoto(null);
                  setIsCreatingNew(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={pendingUploads > 0}
                className="disabled:opacity-50 disabled:cursor-not-allowed gap-2"
              >
                {pendingUploads > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading ({pendingUploads})...</span>
                  </>
                ) : (
                  <span>{isCreatingNew ? "Add to Gallery" : "Save Changes"}</span>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
