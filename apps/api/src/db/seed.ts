import { getDb } from './index.js';
import { venues } from './schema.js';

const SEED_VENUES = [
  // Charlotte, NC
  {
    name: 'Wooden Robot Brewery',
    type: 'Bar',
    address: '1440 S Tryon St Suite 110',
    city: 'Charlotte, NC',
    latitude: Math.round(35.2082 * 1_000_000),
    longitude: Math.round(-80.8622 * 1_000_000),
    hotspotScore: 82,
    voteCount: 134,
    isOpen: true,
    isTrending: true,
    highlights: ['Craft Beer', 'Food Trucks', 'NoDa'],
    priceLevel: 2,
    hours: '4pm - 11pm',
    description: 'NoDa craft brewery known for experimental ales and a rotating food truck lineup.',
  },
  {
    name: 'The Punch Room',
    type: 'Bar',
    address: '401 N Tryon St',
    city: 'Charlotte, NC',
    latitude: Math.round(35.2276 * 1_000_000),
    longitude: Math.round(-80.8431 * 1_000_000),
    hotspotScore: 76,
    voteCount: 89,
    isOpen: true,
    isTrending: false,
    highlights: ['Craft Cocktails', 'Upscale', 'Hotel Bar'],
    priceLevel: 4,
    hours: '5pm - 1am',
    description: 'Award-winning craft cocktail bar atop the Ritz-Carlton in Uptown Charlotte.',
  },
  {
    name: 'Whisky River',
    type: 'Nightclub',
    address: '210 E Trade St',
    city: 'Charlotte, NC',
    latitude: Math.round(35.2270 * 1_000_000),
    longitude: Math.round(-80.8440 * 1_000_000),
    hotspotScore: 68,
    voteCount: 72,
    isOpen: true,
    isTrending: false,
    highlights: ['Dancing', 'Country', 'Live Music'],
    priceLevel: 2,
    hours: '8pm - 2am',
    description: "Dale Earnhardt Jr.'s country-themed nightclub in Uptown Charlotte.",
  },
  // Patchogue, NY
  {
    name: 'Patchogue Arts Council',
    type: 'Music Venue',
    address: '20 Terry St',
    city: 'Patchogue, NY',
    latitude: Math.round(40.7654 * 1_000_000),
    longitude: Math.round(-73.0154 * 1_000_000),
    hotspotScore: 71,
    voteCount: 55,
    isOpen: true,
    isTrending: false,
    highlights: ['Live Music', 'Local Art', 'Events'],
    priceLevel: 1,
    hours: 'Varies by event',
    description: 'Community arts hub hosting live performances and exhibitions in downtown Patchogue.',
  },
  {
    name: "Brickhouse Brewery",
    type: 'Bar',
    address: '67 W Main St',
    city: 'Patchogue, NY',
    latitude: Math.round(40.7649 * 1_000_000),
    longitude: Math.round(-73.0156 * 1_000_000),
    hotspotScore: 79,
    voteCount: 98,
    isOpen: true,
    isTrending: false,
    highlights: ['Craft Beer', 'Pub Food', 'Live Music'],
    priceLevel: 2,
    hours: '11:30am - 12am',
    description: 'Long Island microbrewery and pub on Patchogue\'s lively Main Street.',
  },
  // Sayville, NY
  {
    name: 'The Sayville Inn',
    type: 'Bar',
    address: '126 Middle Rd',
    city: 'Sayville, NY',
    latitude: Math.round(40.7409 * 1_000_000),
    longitude: Math.round(-73.0821 * 1_000_000),
    hotspotScore: 63,
    voteCount: 41,
    isOpen: true,
    isTrending: false,
    highlights: ['Live Music', 'Sports Bar', 'Pub Grub'],
    priceLevel: 2,
    hours: '11am - 2am',
    description: 'Neighborhood sports bar and live music venue in the heart of Sayville.',
  },
  {
    name: 'Village Lanterne',
    type: 'Bar',
    address: '49 Main St',
    city: 'Sayville, NY',
    latitude: Math.round(40.7417 * 1_000_000),
    longitude: Math.round(-73.0829 * 1_000_000),
    hotspotScore: 58,
    voteCount: 34,
    isOpen: true,
    isTrending: false,
    highlights: ['Cocktails', 'Patio', 'Date Night'],
    priceLevel: 3,
    hours: '4pm - 12am',
    description: 'Cozy cocktail bar with a warm atmosphere on Sayville\'s Main Street.',
  },
];

async function seed() {
  const db = getDb();
  console.log('Seeding venues...');
  await db.insert(venues).values(SEED_VENUES).onConflictDoNothing();
  console.log(`Inserted ${SEED_VENUES.length} venues.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
