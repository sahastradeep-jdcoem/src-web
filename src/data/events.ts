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

export const mockEvents: EventItem[] = [];
