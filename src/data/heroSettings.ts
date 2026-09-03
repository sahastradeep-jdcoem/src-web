export interface HeroSettings {
  bgImageUrl: string;
  bgTitle: string;
  bgTag: string;
  cloudIntensity: "subtle" | "vibrant" | "dreamy";
  heroOverline: string;
  heroHeadline: string;
  heroTagline: string;
  tickerText?: string;
}

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  bgImageUrl: "/images/DSC_8361.JPG",
  bgTitle: "SRC Student Council Inauguration Squad",
  bgTag: "Council Assembly",
  cloudIntensity: "vibrant",
  heroOverline: "UNITED BY PURPOSE.",
  heroHeadline: "DRIVEN BY IMPACT.",
  heroTagline: "Leading today. Inspiring tomorrow.",
  tickerText: "Who ARE WE SRC!",
};

export interface HeroPreset {
  name: string;
  url: string;
  category: string;
}

export const PRESET_HERO_BG_IMAGES: HeroPreset[] = [
  {
    name: "SRC Student Council Inauguration Squad",
    url: "/images/DSC_8361.JPG",
    category: "Council Assembly",
  },
  {
    name: "Prarambh Flagship Fest Arena",
    url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2000&auto=format&fit=crop",
    category: "Flagship Fest",
  },
];
