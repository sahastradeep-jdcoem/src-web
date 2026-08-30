import { ClubItem } from "@/types";

export const mockClubs: ClubItem[] = [
  {
    id: "club-dance",
    slug: "dance",
    name: "Dance Club",
    tagline: "Rhythm in Motion, Passion on Stage",
    category: "Cultural",
    description: "The premier choreography society bringing together classical, contemporary, hip-hop, and folk dancers for campus events and national competitions.",
    mission: "To inspire artistic expression, foster stage discipline, and celebrate diverse dance traditions through electrifying performances and workshops.",
    iconName: "Sparkles",
    memberCount: 64,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Computer Science & Engineering",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
    },
    coLead: {
      name: "Club Co-Head Placeholder",
      role: "Club Co-Head",
      department: "Artificial Intelligence & Data Science",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Natyam Choreo Night", "Street Cypher Workshop"],
    pastHighlights: [
      "Secured 1st Place at Central University Dance Fest 2025",
      "Conducted 3-day Western Choreography Bootcamp with 150+ attendees",
      "Flash mob for Prarambh fest teaser launch"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1545224144-b38cd309ef69?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-music",
    slug: "music",
    name: "Music Club",
    tagline: "Where Ideas Become Sound",
    category: "Cultural",
    description: "The home of vocalists, instrumentalists, sound engineers, and music enthusiasts creating original tracks, unplugged jams, and orchestra productions.",
    mission: "To cultivate acoustic, rock, and classical musical talent through studio jamming, live showcases, and inter-collegiate band battles.",
    iconName: "Music",
    memberCount: 58,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Information Technology",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop"
    },
    coLead: {
      name: "Club Co-Head Placeholder",
      role: "Club Co-Head",
      department: "Electronics & Telecommunication",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Battle of the Bands", "Acoustic Sunset Unplugged"],
    pastHighlights: [
      "Composed the official Sahastradeep SRC Anthem 2025",
      "Winners of Regional Battle of the Bands Nagpur",
      "Hosted Sunset Acoustic Sessions in the college amphitheatre"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-drama",
    slug: "drama",
    name: "Drama Club",
    tagline: "Stage, Voice & Expression",
    category: "Cultural",
    description: "Dedicated to street plays (Nukkad Natak), stage theatrics, mime, monologue delivery, and dramatic screenwriting.",
    mission: "To use the powerful medium of theatre for raising social consciousness, refining dramatic craft, and staging captivating campus productions.",
    iconName: "Theater",
    memberCount: 42,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Mechanical Engineering",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Nukkad Natak Street Fest", "Annual Stage Play"],
    pastHighlights: [
      "Awarded Best Social Theme at State Theatrics Meet 2025",
      "Staged the iconic drama 'Aawaz' for 800+ students",
      "Weekly voice modulation and method acting masterclasses"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1469488865564-c2de10f69f96?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-gaming",
    slug: "gaming",
    name: "Gaming Club",
    tagline: "Precision, Strategy & Esports",
    category: "Lifestyle & Operations",
    description: "The competitive esports hub organizing campus LAN tournaments, tactical FPS competitions, console arenas, and streaming showcases.",
    mission: "To establish a structured esports and gaming ecosystem with disciplined strategy, team synergy, and competitive collegiate leagues.",
    iconName: "Gamepad2",
    memberCount: 95,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Computer Science & Engineering",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Valorant Campus Cup", "FIFA & BGMI Mega Championship"],
    pastHighlights: [
      "Organized 128-team BGMI Inter-College Invitational",
      "Built the first JDCOEM LAN Gaming Arena with 40-seat LAN setup",
      "Live streamed finals with 2,500+ peak viewers"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-coding",
    slug: "coding",
    name: "Coding Club",
    tagline: "Algorithms, Open Source & Systems",
    category: "Technical",
    description: "Empowering developers to conquer competitive programming, build scalable web/mobile architectures, and master machine learning solutions.",
    mission: "To foster a peer-to-peer engineering culture centered around problem solving, production-grade projects, and open-source contributions.",
    iconName: "Code2",
    memberCount: 120,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Computer Science & Engineering",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=400&auto=format&fit=crop"
    },
    coLead: {
      name: "Club Co-Head Placeholder",
      role: "Club Co-Head",
      department: "Data Science",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["CodeStorm 24H Hackathon", "LeetCode Speed Sprint"],
    pastHighlights: [
      "Trained 300+ students in Data Structures & System Design",
      "Built internal portal tools for student council registrations",
      "Top 10 national ranking in Smart India Hackathon internal rounds"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-robotics",
    slug: "robotics",
    name: "Robotics Club",
    tagline: "Mechatronics, Automation & AI",
    category: "Technical",
    description: "Designing autonomous rovers, combat war-bots, drones, and IoT automation systems in the dedicated campus makerspace.",
    mission: "To advance hands-on hardware engineering, microcontroller design, PCB fabrication, and mechanical robotics capabilities.",
    iconName: "Bot",
    memberCount: 72,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Mechanical / Mechatronics",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Robo Rage 2026", "Drone Pilot & FPV Workshop"],
    pastHighlights: [
      "Constructed a 30kg combat-ready spinner bot 'Vajra'",
      "Awarded 1st place in Autonomous Maze Navigation at TechFest",
      "Mentored 60+ junior students on Arduino and ROS robotics"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-visual-arts",
    slug: "visual-arts",
    name: "Visual Arts Club",
    tagline: "Cinematography, Photography & Canvas",
    category: "Creative & Media",
    description: "Capturing the visual heartbeat of JDCOEM through editorial photography, cinematography, canvas painting, sketch art, and digital illustration.",
    mission: "To preserve campus memories, master visual storytelling, and showcase high-craft artistic creations across physical and digital galleries.",
    iconName: "Camera",
    memberCount: 48,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Artificial Intelligence & Machine Learning",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Golden Lens Short Film Fest", "Campus Lens Photo Exhibition"],
    pastHighlights: [
      "Official media coverage for Prarambh and Foundation Day",
      "Published the 2025 Annual Visual Yearbook",
      "Conducted Lightroom & Color Grading workshops"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-creative",
    slug: "creative",
    name: "Creative Club",
    tagline: "Design, Copywriting & Conceptual Branding",
    category: "Creative & Media",
    description: "The aesthetic architects behind posters, brand themes, stage decor, digital graphics, and creative copy across Sahastradeep campaigns.",
    mission: "To blend typography, conceptual art, and storytelling into world-class design collateral that defines the prestige of SRC.",
    iconName: "Palette",
    memberCount: 52,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Computer Science & Engineering",
      year: "3rd Year",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Design Sprint Bootcamp", "Creative Brand Slam"],
    pastHighlights: [
      "Crafted full visual identity for Prarambh foundation fest",
      "Curated dynamic physical stage installations for college fests",
      "Conducted UI/UX and Figma masterclasses"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-nexus",
    slug: "nexus",
    name: "Nexus Club",
    tagline: "Innovation, Entrepreneurship & Industry Connect",
    category: "Technical",
    description: "Connecting ambitious students with startup founders, venture incubators, alumni networks, and real-world industrial research.",
    mission: "To bridge the gap between classroom academics and venture building through pitch decks, startup mixers, and product hackathons.",
    iconName: "Network",
    memberCount: 44,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Management Studies (MBA)",
      year: "2nd Year",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Venture Pitch Summit", "JDCOEM Founders Round-table"],
    pastHighlights: [
      "Organized Startup Conclave with 12 angel investors",
      "Helped 4 campus-born startups secure pilot testbeds",
      "Alumni mentorship series connecting 200+ students"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-fitness",
    slug: "fitness",
    name: "Fitness Club",
    tagline: "Strength, Endurance & Sportsmanship",
    category: "Lifestyle & Operations",
    description: "Leading track & field athletics, box cricket, futsal, yoga camps, strength training, and inter-department sports leagues.",
    mission: "To champion holistic wellness, athletic stamina, and competitive sportsmanship across the student body and faculty.",
    iconName: "Dumbbell",
    memberCount: 88,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Civil Engineering",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Clash of Departments (COD)", "Marathon for Green Nagpur"],
    pastHighlights: [
      "Organized Annual JDCOEM Sports Carnival with 1,200+ participants",
      "Inter-College Cricket Champions of Nagpur University Division",
      "Daily morning fitness and calisthenics sessions"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-event",
    slug: "event",
    name: "Event Club",
    tagline: "Logistics, Production & Stagecraft",
    category: "Lifestyle & Operations",
    description: "The operational engine executing large-scale stage management, crowd control, sound production, VIP protocol, and campus hospitality.",
    mission: "To deliver flawless, secure, and punctual execution for all university convocations, national fests, and council ceremonies.",
    iconName: "CalendarDays",
    memberCount: 75,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Electrical Engineering",
      year: "4th Year",
      avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Prarambh Production Ops", "Council Anniversary Assembly"],
    pastHighlights: [
      "Managed seamless logistics for campus gatherings at Prarambh",
      "Zero-incident crowd safety record across all major stage events",
      "Implemented digital accreditation and ticketing systems"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800&auto=format&fit=crop"
    ]
  },
  {
    id: "club-publicity",
    slug: "publicity",
    name: "Publicity Club",
    tagline: "Social Reach, Campaigns & Public Relations",
    category: "Creative & Media",
    description: "Managing official Sahastradeep social channels, press releases, influencer relations, campus buzz campaigns, and alumni outreach.",
    mission: "To amplify the voice of JDCOEM students, drive digital engagement, and maintain official media coverage across Central India.",
    iconName: "Megaphone",
    memberCount: 50,
    established: "2024",
    heroImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1600&auto=format&fit=crop",
    lead: {
      name: "Club Head Placeholder",
      role: "Club Head",
      department: "Management Studies",
      year: "2nd Year",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
    },
    upcomingEvents: ["Prarambh Digital Campaign", "Campus Media Conclave"],
    pastHighlights: [
      "Reached 100K+ impressions across Instagram and LinkedIn during Prarambh",
      "Featured in leading Nagpur newspapers for student innovation initiatives",
      "Produced official daily recap videos and reels"
    ],
    galleryImages: [
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&auto=format&fit=crop"
    ]
  }
];
