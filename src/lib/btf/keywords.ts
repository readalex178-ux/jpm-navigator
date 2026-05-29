// BTF keyword bank — seeded set for ICP discovery on LinkedIn.
// Click-to-copy chips. User-added keywords live in store.keywordBank.

export type KeywordSection = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
};

export const KEYWORD_BANK: KeywordSection[] = [
  {
    id: "titles",
    title: "Job titles & bio",
    subtitle: "What ICPs put in their headline or about section.",
    keywords: [
      "Coach",
      "Consultant",
      "Founder",
      "Course Creator",
      "Online Coach",
      "Business Coach",
      "Mindset Coach",
      "Fitness Coach",
      "Agency Owner",
      "Marketing Consultant",
      "Sales Trainer",
      "Speaker",
      "Mentor",
      "Author",
      "High-Ticket Coach",
      "1:1 Coach",
      "Group Coaching",
      "Mastermind Host",
    ],
  },
  {
    id: "content",
    title: "Content signals",
    subtitle: "Phrases that show they're actively selling.",
    keywords: [
      "DM me",
      "Book a call",
      "Calendar link",
      "Apply here",
      "Comment below",
      "Free training",
      "Free masterclass",
      "Limited spots",
      "Slots open",
      "Now enrolling",
      "Down to last 2",
      "Doors open",
      "Cohort starts",
      "Just helped my client",
      "Client win",
      "Testimonial",
    ],
  },
  {
    id: "pain",
    title: "Pain signals",
    subtitle: "Language that signals they need outbound.",
    keywords: [
      "Slow month",
      "Quiet quarter",
      "Need clients",
      "Looking for clients",
      "Referrals only",
      "Hate marketing",
      "No leads",
      "Lead gen sucks",
      "Wearing all the hats",
      "Burned out",
      "Tired of posting",
      "Algorithm killed",
      "Reach is dead",
      "Want to scale",
      "Ready to scale",
      "Hiring a setter",
      "Need a closer",
    ],
  },
];
