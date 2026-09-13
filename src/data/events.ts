import { EventItem } from "@/types";

export const defaultPrarambhEvent: EventItem = {
  id: "evt-prarambh",
  slug: "prarambh",
  name: "PRARAMBH",
  tagline: "The Inception of Sahastradeep",
  category: "Fest",
  date: "Annual Flagship Fest",
  time: "Full Day Collegiate Showcase",
  venue: "JDCOEM Central Campus, Nagpur",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "event",
  status: "Registration Open",
  isFeatured: true,
  poster: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop",
  description: "The flagship annual foundation and cultural extravaganza of JDCOEM Nagpur. Uniting all student bodies, departments, and clubs under the banner of Sahastradeep.",
  about: "Prarambh marks the premier collegiate festival and council inception hosted by the Student Representative Council (Sahastradeep). Bringing together students across engineering, technology, and management departments to compete, perform, and celebrate institutional excellence.",
  whatToExpect: [
    "Grand Stage Showcases, Cultural Performances & Band Showdowns",
    "Inter-Department Championships & Technical Competitions",
    "Club Charters, Exhibits, and Creative Arenas",
    "Official Accreditation and Verified Digital Delegate Passes"
  ],
  rules: [
    "All participants must carry their official College ID along with the digital SRC Ticket QR.",
    "Department delegations must be accredited through the SRC portal.",
    "Fair play and respectful collegiate conduct are mandatory across all arenas."
  ],
  schedule: [
    {
      time: "Morning • 10:00 AM",
      title: "Grand Inauguration & Sahastradeep Lamp Lighting",
      description: "Official opening ceremony with dignitaries, council investiture, and cultural prologue.",
      venue: "Central Amphitheatre"
    },
    {
      time: "Afternoon • 01:30 PM",
      title: "Technical, Cultural & Department Showcases",
      description: "Competitions, club arenas, and inter-department showcases across campus.",
      venue: "Main Quadrangle & Stages"
    },
    {
      time: "Evening • 06:00 PM",
      title: "Awards Gala & Headline Concert",
      description: "Felicitation ceremony and headline evening performances.",
      venue: "JDCOEM Central Grounds"
    }
  ],
  prizes: [
    {
      position: "Winner (Overall Championship)",
      amount: "Championship Shield",
      perks: ["Sahastradeep Championship Shield", "Gold Medals", "Official Institutional Citations"]
    },
    {
      position: "Runner Up",
      amount: "Silver Trophy & Accreditations",
      perks: ["Silver Trophy", "Merit Citations"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 10,
  registrationDeadline: "Open for Registrations",
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "SRC Secretariat Desk",
    role: "Central Student Council",
    phone: "srcjdcoem@gmail.com"
  }
};

export const bollywoodDayEvent: EventItem = {
  id: "evt-1789248106702-8me7",
  slug: "bollywood-day",
  name: "Bollywood Day",
  tagline: "Relive the Magic, Drama & Glamour of Indian Cinema",
  category: "Cultural",
  date: "18 September 2026",
  rawDate: "2026-09-18",
  time: "11:00 AM - 04:00 PM",
  venue: "Main Auditorium, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "cultural",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1600&auto=format&fit=crop",
  description: "Celebrate the vibrant colors, iconic dialogues, and unforgettable music of Indian cinema in this college-wide Bollywood showcase.",
  about: "Bollywood Day invites students from JDCOEM and accredited colleges to showcase their flair for music, dance, dramatic monologues, and iconic costume tributes. Join us for a day of pure cinematic celebration.",
  whatToExpect: [
    "Iconic Bollywood Costume Parade & Ramp Walk",
    "Solo & Group Dance Face-Offs",
    "Retro & Modern Soundtrack Performances",
    "Digital Delegate Badges and Spot Prizes"
  ],
  rules: [
    "Costumes and musical selections must adhere to collegiate decency standards.",
    "Bring official College ID along with the SRC Ticket QR pass.",
    "Reporting time: 30 minutes before the scheduled stage slot."
  ],
  schedule: [
    {
      time: "11:00 AM",
      title: "Inauguration & Cinematic Welcome",
      description: "Opening medley performance by SRC Cultural Club.",
      venue: "Main Auditorium"
    },
    {
      time: "12:30 PM",
      title: "Costume Walk & Monologue Competitions",
      description: "Student character showcases and spotlight performances.",
      venue: "Main Stage"
    },
    {
      time: "03:00 PM",
      title: "Grand Finale & Prize Distribution",
      description: "Announcement of Best Dressed, Top Performers, and Trophies.",
      venue: "Main Stage"
    }
  ],
  prizes: [
    {
      position: "Best Dressed & Spotlight Award",
      amount: "Trophy & Accreditations",
      perks: ["Official Institutional Trophy", "Merit Certificate"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 4,
  entryFee: "₹1",
  isPaid: true,
  feeAmount: 1,
  feePricingModel: "per_person",
  registrationDeadline: "17 September 2026",
  coordinatorContact: {
    name: "SRC Cultural Secretariat",
    role: "Lead Coordinator",
    phone: "8237981028"
  }
};

export const codeAlphaEvent: EventItem = {
  id: "evt-1789231618523-hfyv",
  slug: "codealpha",
  name: "CodeAlpha",
  tagline: "The Premier Collegiate Algorithmic Coding Challenge",
  category: "Technical",
  date: "19 September 2026",
  rawDate: "2026-09-19",
  time: "10:00 AM - 01:00 PM",
  venue: "Central Computing Complex (Lab 3 & 4), JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "code",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
  description: "Battle against top collegiate programmers in intense algorithmic problem solving, data structures, and speed coding rounds.",
  about: "CodeAlpha tests your computational thinking, algorithmic efficiency, and debugging speed. Open to both individual coders and duos across all undergraduate programs.",
  whatToExpect: [
    "Competitive Coding with Live Leaderboards",
    "Dynamic Problem Sets spanning Arrays, Trees, DP & Graphs",
    "Automated Test Case Evaluation",
    "Recognized Merit Citations for Top Rankers"
  ],
  rules: [
    "All code submissions will run through automated plagiarism and similarity checkers.",
    "Supported languages: C++, Java, Python, and JavaScript.",
    "Participants must bring valid institutional photo ID."
  ],
  schedule: [
    {
      time: "10:00 AM",
      title: "System Setup & Platform Briefing",
      description: "Distribution of credentials and warm-up trial run.",
      venue: "Lab 3 & 4"
    },
    {
      time: "10:30 AM",
      title: "Sprint Round (Algorithmic Problems)",
      description: "Two hours of intense live coding problems.",
      venue: "Computing Complex"
    },
    {
      time: "12:45 PM",
      title: "Leaderboard Freeze & Winner Announcement",
      description: "Presentation of winners and code review breakdown.",
      venue: "Seminar Hall 1"
    }
  ],
  prizes: [
    {
      position: "1st Place Winner",
      amount: "₹1,000 & Winner Trophy",
      perks: ["First Place Winner Shield", "Certificate of Excellence"]
    },
    {
      position: "Runner Up",
      amount: "₹500 & Medal",
      perks: ["Runner Up Medal", "Certificate of Merit"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 2,
  entryFee: "₹10",
  isPaid: true,
  feeAmount: 10,
  feePricingModel: "per_person",
  registrationDeadline: "18 September 2026",
  coordinatorContact: {
    name: "SRC Tech Council",
    role: "Technical Lead",
    phone: "8237981028"
  }
};

export const testingEvent: EventItem = {
  id: "evt-1789295005208-ba76",
  slug: "testing",
  name: "Testing",
  tagline: "Live Software Quality Assurance & Bug Hunt Challenge",
  category: "Technical",
  date: "20 September 2026",
  rawDate: "2026-09-20",
  time: "02:00 PM - 04:30 PM",
  venue: "Lab 2, Central Computing Center, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "tech",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  poster: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop",
  description: "Hands-on software testing arena focusing on unit testing, automation suites, security edge-cases, and bug reporting.",
  about: "Put your QA skills to the test in this interactive software testing and vulnerability discovery challenge. Find hidden edge cases, verify regression tests, and write robust assertion suites.",
  whatToExpect: [
    "Real-World Web App Bug Hunting",
    "Automated Assertion & Unit Test Writing",
    "Security & Boundary Condition Stress Testing",
    "Immediate Verification and Feedback"
  ],
  rules: [
    "Use provided test environments and mock credentials.",
    "Bugs must be logged with reproducible steps and screenshots.",
    "Individual participation only."
  ],
  schedule: [
    {
      time: "02:00 PM",
      title: "Environment Walkthrough & Scope",
      description: "Briefing on target web application and test targets.",
      venue: "Lab 2"
    },
    {
      time: "02:30 PM",
      title: "Live Bug Hunt & QA Sprint",
      description: "Find, report, and automate test cases.",
      venue: "Lab 2"
    },
    {
      time: "04:15 PM",
      title: "Evaluation & Certificates",
      description: "Scoring of verified bugs and QA submissions.",
      venue: "Lab 2"
    }
  ],
  prizes: [
    {
      position: "Top QA Hunter",
      amount: "Winner Citation",
      perks: ["Top Bug Hunter Certificate", "Accreditation Badge"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "₹1.02",
  isPaid: true,
  feeAmount: 1.02,
  feePricingModel: "per_person",
  registrationDeadline: "20 September 2026",
  coordinatorContact: {
    name: "Harsh Shende",
    role: "QA Lead",
    phone: "8237981028"
  }
};

export const workshopEvent: EventItem = {
  id: "evt-1789288760491-2sih",
  slug: "workshop",
  name: "Workshop",
  tagline: "Hands-on Technical Masterclass & Development Bootcamp",
  category: "Workshops",
  date: "21 September 2026",
  rawDate: "2026-09-21",
  time: "10:30 AM - 03:30 PM",
  venue: "Seminar Hall 2, JDCOEM Campus",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "event",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  poster: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop",
  description: "An intensive, practical hands-on workshop guiding students through modern full-stack web engineering, cloud deployment, and system architecture.",
  about: "Designed for ambitious engineering students looking to elevate their practical skillset. Build, debug, and deploy a live project with mentorship from council tech leads.",
  whatToExpect: [
    "Guided Step-by-Step Architecture Walkthrough",
    "Live Cloud Deployment and Tooling Setup",
    "Interactive Q&A and Mentorship",
    "Official Verified Participation Credential"
  ],
  rules: [
    "Bring your personal laptop and charger.",
    "Pre-requisite tools: Git, Node.js, and VS Code pre-installed.",
    "Active participation is required for certification."
  ],
  schedule: [
    {
      time: "10:30 AM",
      title: "Kickoff & Core Architecture Overview",
      description: "Introduction to production-grade architecture patterns.",
      venue: "Seminar Hall 2"
    },
    {
      time: "01:00 PM",
      title: "Hands-on Lab & Implementation",
      description: "Guided coding session and feature building.",
      venue: "Seminar Hall 2"
    },
    {
      time: "03:00 PM",
      title: "Deployment & Certificate Distribution",
      description: "Live launch verification and distribution of credentials.",
      venue: "Seminar Hall 2"
    }
  ],
  prizes: [
    {
      position: "Verified Participant",
      amount: "Official Certification",
      perks: ["SRC JDCOEM Certificate of Participation"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "₹2",
  isPaid: true,
  feeAmount: 2,
  feePricingModel: "per_person",
  registrationDeadline: "20 September 2026",
  coordinatorContact: {
    name: "SRC Workshop Coordinator",
    role: "Coordinator",
    phone: "8237981028"
  }
};

export const test2Event: EventItem = {
  id: "evt-test2",
  slug: "test2",
  name: "Test2",
  tagline: "Phase 2 Software Reliability & Integration Trials",
  category: "Technical",
  date: "21 September 2026",
  rawDate: "2026-09-21",
  time: "03:00 PM - 05:00 PM",
  venue: "Lab 2, Central Computing Center, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "coding",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  poster: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1600&auto=format&fit=crop",
  description: "Secondary verification trials and software integration testing for platform reliability and real-time stress assessment.",
  about: "Test2 is the follow-up QA and testing arena designed to benchmark performance under concurrent loads, test edge cases in web security, and audit database endpoints.",
  whatToExpect: [
    "Load Testing & API Benchmarking",
    "Regression and Endpoint Verification",
    "Real-Time Assertions & Defect Triage",
    "Technical Commendations"
  ],
  rules: [
    "Participants must use standard testing sandboxes provided by SRC.",
    "Logs must include timestamped error traces.",
    "Individual entries only."
  ],
  schedule: [
    {
      time: "03:00 PM",
      title: "Test Scope & Briefing",
      description: "Distribution of API endpoints and performance parameters.",
      venue: "Lab 2"
    },
    {
      time: "03:30 PM",
      title: "Load Stress & Integration Sprints",
      description: "Execution of test suites and logging findings.",
      venue: "Lab 2"
    },
    {
      time: "04:45 PM",
      title: "Wrap-up & Review",
      description: "Review of QA logs and validation reports.",
      venue: "Lab 2"
    }
  ],
  prizes: [
    {
      position: "Verified Tester",
      amount: "Accreditation Certificate",
      perks: ["QA Specialist Badge", "SRC Tech Accreditation"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "Harsh Shende",
    role: "QA Lead",
    phone: "8237981028"
  }
};

export const codeAndCraftEvent: EventItem = {
  id: "evt-code-and-craft",
  slug: "code-and-craft",
  name: "Code & Craft",
  tagline: "Where Engineering Architecture Meets Aesthetic Design",
  category: "Technical",
  date: "23 September 2026",
  rawDate: "2026-09-23",
  time: "10:00 AM - 04:30 PM",
  venue: "Makerspace & Creative Studio, JDCOEM",
  organizer: "Coding Club & Creative Club",
  organizerClubSlug: "coding",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1600&auto=format&fit=crop",
  description: "An interdisciplinary sprint uniting software engineers with visual designers to build, design, and pitch complete digital products.",
  about: "Code & Craft celebrates the synergy between rigorous backend code and intuitive, beautiful user interface design. Teams receive real-world problem statements and must deliver both a working prototype and cohesive visual identity.",
  whatToExpect: [
    "Full-Stack Web/App Development Sprint",
    "UI/UX Design, Design Tokens & Wireframing",
    "Product Pitch & Live Demonstration",
    "Trophies and Official Council Citations"
  ],
  rules: [
    "Teams can consist of 1 to 4 members.",
    "All code and visual designs must be produced during the competition window.",
    "Open-source libraries and component systems are permitted with attribution."
  ],
  schedule: [
    {
      time: "10:00 AM",
      title: "Problem Statement Release & Kickoff",
      description: "Briefing on design criteria, API access, and judging rubric.",
      venue: "Makerspace"
    },
    {
      time: "10:30 AM",
      title: "Sprint Session: Code & UI Design",
      description: "Rapid prototyping, wireframing, and code implementation.",
      venue: "Computing Complex"
    },
    {
      time: "03:30 PM",
      title: "Product Showcase & Pitch Finale",
      description: "Live 3-minute demos to jury of faculty and industry mentors.",
      venue: "Seminar Hall 1"
    }
  ],
  prizes: [
    {
      position: "1st Place Winner",
      amount: "Championship Trophy & Citations",
      perks: ["Code & Craft Winner Shield", "Gold Certificates of Excellence"]
    },
    {
      position: "Best UI/UX Design",
      amount: "Design Excellence Award",
      perks: ["Creative Trophy", "Design Merit Badge"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 4,
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "SRC Coding & Creative Desk",
    role: "Lead Coordinators",
    phone: "8237981028"
  }
};

export const speechArenaEvent: EventItem = {
  id: "evt-speech-arena",
  slug: "speech-arena",
  name: "Speech Arena",
  tagline: "The Ultimate Stage for Voice, Oratory & Parliamentary Debate",
  category: "Competitions",
  date: "24 September 2026",
  rawDate: "2026-09-24",
  time: "11:00 AM - 03:30 PM",
  venue: "Central Amphitheatre / Seminar Hall 1, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "publicity",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1600&auto=format&fit=crop",
  description: "Step up to the podium and battle in extempore speaking, parliamentary debate, and persuasive oratory before an esteemed panel of judges.",
  about: "Speech Arena is JDCOEM's flagship oratory and collegiate debating platform. Test your rhetorical eloquence, critical reasoning, and impromptu speaking prowess across multi-format debate rounds.",
  whatToExpect: [
    "Impromptu & Extempore Speaking Showdown",
    "Oxford-Style Parliamentary Debate Face-Off",
    "Cross-Examination & Audience Rebuttal",
    "Best Speaker and Best Orator Trophies"
  ],
  rules: [
    "Topics will be drawn 5 minutes prior to the speaking slot.",
    "Parliamentary decency and collegiate decorum must be upheld at all times.",
    "Time limits: 3 minutes speech + 1 minute rebuttal."
  ],
  schedule: [
    {
      time: "11:00 AM",
      title: "Opening & Topic Draw",
      description: "Briefing on rules and round 1 topic draws.",
      venue: "Seminar Hall 1"
    },
    {
      time: "11:30 AM",
      title: "Round 1: Extempore Oratory",
      description: "Solo presentations across contemporary social and tech themes.",
      venue: "Seminar Hall 1"
    },
    {
      time: "02:00 PM",
      title: "Round 2: The Parliamentary Debate",
      description: "Top 8 finalists face off in head-to-head Oxford debates.",
      venue: "Main Amphitheatre"
    }
  ],
  prizes: [
    {
      position: "Best Orator (Winner)",
      amount: "Winner Trophy & Accreditations",
      perks: ["Golden Microphone Trophy", "Official Merit Citation"]
    },
    {
      position: "Best Rebuttal / Runner Up",
      amount: "Silver Trophy",
      perks: ["Debater of the Year Medal", "Accreditation Certificate"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "SRC Oratory Secretariat",
    role: "Debate Lead",
    phone: "8237981028"
  }
};

export const jammingSessionEvent: EventItem = {
  id: "evt-jamming-session",
  slug: "jamming-session",
  name: "Jamming session",
  tagline: "Sunset Acoustic Chords, Open Mic & Live Campus Melodies",
  category: "Cultural",
  date: "25 September 2026",
  rawDate: "2026-09-25",
  time: "05:00 PM - 08:30 PM",
  venue: "Central Amphitheatre, JDCOEM Campus",
  organizer: "Music Club (SRC JDCOEM)",
  organizerClubSlug: "music",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop",
  description: "An electric sunset open mic and acoustic jamming session bringing together campus vocalists, guitarists, beatboxers, and indie bands under the evening sky.",
  about: "Jamming Session is a pure musical evening open to all acoustic musicians, vocalists, and music enthusiasts. Bring your instrument, take the open mic, or relax on the amphitheatre lawn with friends.",
  whatToExpect: [
    "Acoustic & Semi-Unplugged Stage Performances",
    "Open Mic Slots for Solo Singers and Rappers",
    "Beatboxing Showdowns and Drum Circles",
    "Collaborative Campus Band Medleys"
  ],
  rules: [
    "Acoustic and semi-plugged instruments welcome (PA system provided).",
    "Open mic slots must be pre-registered or checked in 15 minutes before showtime.",
    "Song choices should adhere to collegiate performance standards."
  ],
  schedule: [
    {
      time: "05:00 PM",
      title: "Sunset Acoustic Opening",
      description: "Opening unplugged set by Music Club ensemble.",
      venue: "Central Amphitheatre"
    },
    {
      time: "06:00 PM",
      title: "Open Mic & Student Spotlight",
      description: "Registered student vocalists and instrumentalists.",
      venue: "Central Amphitheatre"
    },
    {
      time: "07:30 PM",
      title: "Grand Collaborative Jam",
      description: "All-in musical jam and headline encore.",
      venue: "Central Amphitheatre"
    }
  ],
  prizes: [
    {
      position: "Spotlight Performer of the Night",
      amount: "Musical Honor & Shield",
      perks: ["Acoustic Excellence Shield", "Featured SRC Studio Recording Opportunity"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 6,
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "Music Club Head",
    role: "Music Lead",
    phone: "8237981028"
  }
};

export const authenticEvents: EventItem[] = [
  bollywoodDayEvent,
  codeAlphaEvent,
  testingEvent,
  test2Event,
  workshopEvent,
  codeAndCraftEvent,
  speechArenaEvent,
  jammingSessionEvent
];

export const mockEvents: EventItem[] = authenticEvents;
