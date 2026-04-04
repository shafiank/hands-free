'use server';

/**
 * Hands Free â€” Google Places REST API Actions
 *
 * searchNearbyPlaces / searchPlacesNearby â†’ Places API (New) v1
 *   POST https://places.googleapis.com/v1/places:searchText
 *   POST https://places.googleapis.com/v1/places:searchNearby
 *   Auth via X-Goog-Api-Key + X-Goog-FieldMask headers (new requirement)
 *
 * getPlaceDetails â†’ Places API (New) v1
 *   GET  https://places.googleapis.com/v1/places/{id}
 *
 * geocodeAddress  â†’ Geocoding API (legacy still works, not deprecated)
 * getDirections   â†’ Directions API (legacy still works, not deprecated)
 *
 * All functions return the same PlaceResult shape as before so orchestrator.ts
 * requires zero changes.
 */

import { loadSettings } from './chat';

// â”€â”€ Base URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PLACES_V1_BASE  = 'https://places.googleapis.com/v1/places';
const GEOCODE_BASE    = 'https://maps.googleapis.com/maps/api/geocode';
const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions';

// FieldMask for search results (controls which fields are returned)
const SEARCH_FIELD_MASK =
    'places.id,places.displayName,places.formattedAddress,places.rating,' +
    'places.userRatingCount,places.location,places.types,places.regularOpeningHours,' +
    'places.photos,places.priceLevel,places.nationalPhoneNumber,places.websiteUri';

const DETAIL_FIELD_MASK =
    'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,' +
    'regularOpeningHours,rating,reviews,userRatingCount,websiteUri,priceLevel,' +
    'location,photos,types';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getApiKey(): Promise<string> {
    const settings = await loadSettings();
    const key = (settings as any).googlePlacesApiKey;
    if (!key) throw new Error('Google Places API key not configured. Please add it in Settings.');
    return key;
}

/** POST to the new Places v1 API with proper headers */
async function v1Post(endpoint: string, apiKey: string, body: object, fieldMask: string): Promise<any> {
    const res = await fetch(`${PLACES_V1_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type':    'application/json',
            'X-Goog-Api-Key':  apiKey,
            'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Google Places API HTTP ${res.status}: ${err?.error?.message ?? res.statusText}`);
    }
    return res.json();
}

/** GET to the new Places v1 API with proper headers */
async function v1Get(path: string, apiKey: string, fieldMask: string): Promise<any> {
    const res = await fetch(`${PLACES_V1_BASE}/${path}`, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key':  apiKey,
            'X-Goog-FieldMask': fieldMask,
        },
        cache: 'no-store',
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Google Places API HTTP ${res.status}: ${err?.error?.message ?? res.statusText}`);
    }
    return res.json();
}

/** GET to a legacy Google Maps API (Geocoding, Directions â€” not deprecated) */
async function legacyGet(url: string): Promise<any> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Google API HTTP ${res.status}`);
    const data = await res.json();
    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
        throw new Error(`Google API error: ${data.status} â€” ${data.error_message ?? ''}`);
    }
    return data;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
}

/** Map a v1 Place object to the legacy PlaceResult shape */
function mapV1Place(p: any): PlaceResult {
    return {
        place_id:              p.id ?? '',
        name:                  p.displayName?.text ?? p.name ?? '',
        formatted_address:     p.formattedAddress ?? '',
        vicinity:              p.formattedAddress ?? '',
        rating:                p.rating,
        user_ratings_total:    p.userRatingCount,
        opening_hours: p.regularOpeningHours ? {
            open_now:      p.regularOpeningHours.openNow,
            weekday_text:  p.regularOpeningHours.weekdayDescriptions,
        } : undefined,
        geometry: p.location ? {
            location: { lat: p.location.latitude, lng: p.location.longitude },
        } : undefined,
        types:                 p.types,
        photos:                p.photos?.map((ph: any) => ({ photo_reference: ph.name ?? '' })),
        international_phone_number: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
        website:               p.websiteUri,
        price_level:           p.priceLevel !== undefined
            ? { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[p.priceLevel as string] ?? undefined
            : undefined,
    };
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PlaceResult {
    place_id: string;
    name: string;
    formatted_address?: string;
    vicinity?: string;
    rating?: number;
    user_ratings_total?: number;
    opening_hours?: {
        open_now?: boolean;
        weekday_text?: string[];
    };
    geometry?: {
        location: { lat: number; lng: number };
    };
    types?: string[];
    photos?: { photo_reference: string }[];
    international_phone_number?: string;
    website?: string;
    price_level?: number; // 0â€“4
}

export interface DirectionStep {
    html_instructions: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    travel_mode: string;
}

export interface DirectionsResult {
    summary: string;
    distance: string;
    duration: string;
    steps: DirectionStep[];
    start_address: string;
    end_address: string;
}

// â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Text search for places (e.g. "pizza near Times Square").
 * Uses Places API (New): POST /v1/places:searchText
 */
export async function searchNearbyPlaces(options: {
    query: string;
    location?: string;        // "lat,lng"
    radius?: number;          // metres (max 50000)
    type?: string;            // e.g. "restaurant" | "hospital" | "school"
    language?: string;        // e.g. "en"
    openNow?: boolean;
}): Promise<{ success: boolean; places?: PlaceResult[]; error?: string }> {
    try {
        const key = await getApiKey();

        const body: Record<string, any> = {
            textQuery:      options.query,
            maxResultCount: 20,
        };
        if (options.language) body.languageCode = options.language;
        if (options.openNow)  body.openNow      = true;
        if (options.type)     body.includedType  = options.type;

        // Optional location bias
        if (options.location) {
            const [latStr, lngStr] = options.location.split(',');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            if (!isNaN(lat) && !isNaN(lng)) {
                body.locationBias = {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: options.radius ?? 5000,
                    },
                };
            }
        }

        const data = await v1Post(':searchText', key, body, SEARCH_FIELD_MASK);
        const places = (data.places ?? []).map(mapV1Place);
        return { success: true, places };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Nearby search anchored to a lat/lng coordinate.
 * Uses Places API (New): POST /v1/places:searchNearby
 */
export async function searchPlacesNearby(options: {
    location: string;   // "lat,lng"
    radius: number;     // metres
    keyword?: string;
    type?: string;
    openNow?: boolean;
    language?: string;
}): Promise<{ success: boolean; places?: PlaceResult[]; error?: string }> {
    try {
        const key = await getApiKey();

        const [latStr, lngStr] = options.location.split(',');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (isNaN(lat) || isNaN(lng)) {
            return { success: false, error: 'Invalid location format. Expected "lat,lng".' };
        }

        const body: Record<string, any> = {
            locationRestriction: {
                circle: {
                    center: { latitude: lat, longitude: lng },
                    radius: options.radius,
                },
            },
            maxResultCount: 20,
        };
        if (options.language)  body.languageCode    = options.language;
        if (options.type)      body.includedTypes    = [options.type];
        if (options.keyword)   body.textQuery        = options.keyword; // keyword search via textQuery

        const data = await v1Post(':searchNearby', key, body, SEARCH_FIELD_MASK);
        const places = (data.places ?? []).map(mapV1Place);
        return { success: true, places };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Full place details.
 * Uses Places API (New): GET /v1/places/{id}
 */
export async function getPlaceDetails(options: {
    placeId: string;
    fields?: string;
    language?: string;
}): Promise<{ success: boolean; place?: PlaceResult; error?: string }> {
    try {
        const key    = await getApiKey();
        const data   = await v1Get(options.placeId, key, DETAIL_FIELD_MASK);
        return { success: true, place: mapV1Place(data) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Geocode a human-readable address to lat/lng coordinates.
 * Uses Geocoding API (legacy â€” not deprecated).
 */
export async function geocodeAddress(options: {
    address: string;
    language?: string;
}): Promise<{ success: boolean; location?: { lat: number; lng: number }; formatted_address?: string; error?: string }> {
    try {
        const key    = await getApiKey();
        const params = { address: options.address, key, language: options.language };
        const data   = await legacyGet(`${GEOCODE_BASE}/json?${qs(params)}`);

        if (!data.results?.length) {
            return { success: false, error: 'Address not found.' };
        }

        const first = data.results[0];
        return {
            success:           true,
            location:          first.geometry.location,
            formatted_address: first.formatted_address,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Turn-by-turn directions between two locations.
 * Uses Directions API (legacy â€” not deprecated).
 */
export async function getDirections(options: {
    origin:         string;
    destination:    string;
    mode?:          'driving' | 'walking' | 'bicycling' | 'transit';
    language?:      string;
    departureTime?: 'now' | number;
}): Promise<{ success: boolean; directions?: DirectionsResult; error?: string }> {
    try {
        const key = await getApiKey();
        const params: Record<string, string | number | boolean | undefined> = {
            origin:      options.origin,
            destination: options.destination,
            mode:        options.mode ?? 'driving',
            key,
        };
        if (options.language)      params.language       = options.language;
        if (options.departureTime) params.departure_time = options.departureTime;

        const data = await legacyGet(`${DIRECTIONS_BASE}/json?${qs(params)}`);

        if (!data.routes?.length) {
            return { success: false, error: 'No routes found.' };
        }

        const route = data.routes[0];
        const leg   = route.legs[0];

        const steps: DirectionStep[] = (leg.steps ?? []).map((s: any) => ({
            html_instructions: s.html_instructions,
            distance:          s.distance,
            duration:          s.duration,
            travel_mode:       s.travel_mode,
        }));

        return {
            success: true,
            directions: {
                summary:       route.summary,
                distance:      leg.total_distance?.text ?? leg.distance?.text ?? '',
                duration:      leg.total_duration?.text ?? leg.duration?.text ?? '',
                start_address: leg.start_address,
                end_address:   leg.end_address,
                steps,
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Build a Google Maps photo URL.
 * Uses the new Places v1 photo media endpoint.
 */
export async function getPlacePhotoUrl(options: {
    photoReference: string;
    maxWidth?: number;
}): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const key = await getApiKey();
        // New v1 format: places/{place_id}/photos/{photo_id}/media
        // photo_reference in v1 is already the full resource name (places/.../photos/...)
        const ref = options.photoReference;
        const url = ref.startsWith('places/')
            ? `${PLACES_V1_BASE.replace('/places', '')}/${ref}/media?maxWidthPx=${options.maxWidth ?? 800}&key=${key}`
            : `https://maps.googleapis.com/maps/api/place/photo?photoreference=${encodeURIComponent(ref)}&maxwidth=${options.maxWidth ?? 800}&key=${key}`;
        return { success: true, url };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
