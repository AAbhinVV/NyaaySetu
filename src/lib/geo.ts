/**
 * Simple geo-matching for Indian courts.
 * Maps a city to the most likely court name and jurisdiction details.
 * This is a basic implementation — a full version would use a court API.
 */

const CITY_COURT_MAP: Record<string, { courtName: string; jurisdiction: string }> = {
    'delhi': { courtName: 'Patiala House Court', jurisdiction: 'New Delhi' },
    'new delhi': { courtName: 'Patiala House Court', jurisdiction: 'New Delhi' },
    'mumbai': { courtName: 'Bombay High Court', jurisdiction: 'Mumbai' },
    'pune': { courtName: 'Pune District Court', jurisdiction: 'Pune' },
    'bangalore': { courtName: 'Karnataka High Court', jurisdiction: 'Bangalore' },
    'bengaluru': { courtName: 'Karnataka High Court', jurisdiction: 'Bangalore' },
    'chennai': { courtName: 'Madras High Court', jurisdiction: 'Chennai' },
    'hyderabad': { courtName: 'Telangana High Court', jurisdiction: 'Hyderabad' },
    'kolkata': { courtName: 'Calcutta High Court', jurisdiction: 'Kolkata' },
    'ahmedabad': { courtName: 'Gujarat High Court', jurisdiction: 'Ahmedabad' },
    'jaipur': { courtName: 'Rajasthan High Court', jurisdiction: 'Jaipur' },
    'lucknow': { courtName: 'Lucknow Bench, Allahabad High Court', jurisdiction: 'Lucknow' },
    'chandigarh': { courtName: 'Punjab and Haryana High Court', jurisdiction: 'Chandigarh' },
    'patna': { courtName: 'Patna High Court', jurisdiction: 'Patna' },
    'kochi': { courtName: 'Kerala High Court', jurisdiction: 'Kochi' },
    'guwahati': { courtName: 'Gauhati High Court', jurisdiction: 'Guwahati' },
    'bhopal': { courtName: 'Madhya Pradesh High Court', jurisdiction: 'Bhopal' },
    'indore': { courtName: 'Indore Bench, MP High Court', jurisdiction: 'Indore' },
}

/** Get court for a city. Falls back to District Court if city not mapped. */
export function getCourtForCity(city: string): { courtName: string; jurisdiction: string } {
    const normalized = city.toLowerCase().trim()
    return CITY_COURT_MAP[normalized] ?? {
        courtName: `${city} District Court`,
        jurisdiction: city,
    }
}

/** Generate a unique e-token string for a case. */
export function generateEToken(city: string): string {
    const prefix = city.substring(0, 3).toUpperCase()
    const uuid = crypto.randomUUID().slice(0, 8).toUpperCase()
    return `NYS-${prefix}-${uuid}-${Date.now()}`
}
