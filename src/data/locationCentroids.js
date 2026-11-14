// Approximate centres for map pins when a listing has no coordinates (only 56 of 6,866 listings
// had lat/lng on 2026-11-14). District values are district headquarters; area values are
// neighbourhood centres. Precision is a few km: the map draws a circle, never an exact pin.
import { placeKey } from '../lib/search/normalize.js'
import { DISTRICT_STORED_SPELLINGS } from '../lib/search/aliases.js'

const DISTRICTS = {
  Dhaka: [23.8103, 90.4125], Faridpur: [23.607, 89.8429], Gazipur: [24.0023, 90.4264], Gopalganj: [23.005, 89.8266],
  Kishoreganj: [24.4449, 90.7766], Madaripur: [23.1641, 90.1896], Manikganj: [23.8644, 90.0047], Munshiganj: [23.5422, 90.5305],
  Narayanganj: [23.6238, 90.5], Narsingdi: [23.9322, 90.7151], Rajbari: [23.7574, 89.6445], Shariatpur: [23.2423, 90.4348],
  Tangail: [24.2513, 89.9167],
  Chattogram: [22.3569, 91.7832], Bandarban: [22.1953, 92.2184], Brahmanbaria: [23.9608, 91.1115], Chandpur: [23.2333, 90.6713],
  Comilla: [23.4607, 91.1809], "Cox's Bazar": [21.4272, 92.0058], Feni: [23.0159, 91.3976], Khagrachari: [23.1193, 91.9847],
  Lakshmipur: [22.9447, 90.8282], Noakhali: [22.8696, 91.0995], Rangamati: [22.7324, 92.2985],
  Rajshahi: [24.3745, 88.6042], Bogura: [24.8465, 89.3776], Chapainawabganj: [24.5965, 88.2776], Joypurhat: [25.0968, 89.0227],
  Naogaon: [24.7936, 88.9318], Natore: [24.4206, 89.0003], Pabna: [24.0064, 89.2372], Sirajganj: [24.4534, 89.7007],
  Khulna: [22.8456, 89.5403], Bagerhat: [22.6516, 89.7859], Chuadanga: [23.6402, 88.8418], Jessore: [23.1664, 89.2081],
  Jhenaidah: [23.545, 89.1726], Kushtia: [23.9013, 89.1204], Magura: [23.4855, 89.4198], Meherpur: [23.7622, 88.6318],
  Narail: [23.1725, 89.5127], Satkhira: [22.7185, 89.0705],
  Barishal: [22.701, 90.3535], Barguna: [22.0953, 90.1121], Bhola: [22.6859, 90.6482], Jhalokati: [22.6406, 90.1987],
  Patuakhali: [22.3596, 90.3299], Pirojpur: [22.5841, 89.972],
  Sylhet: [24.8949, 91.8687], Habiganj: [24.3745, 91.4155], Moulvibazar: [24.4829, 91.7774], Sunamganj: [25.0658, 91.395],
  Rangpur: [25.7439, 89.2752], Dinajpur: [25.6217, 88.6354], Gaibandha: [25.3288, 89.528], Kurigram: [25.8072, 89.6295],
  Lalmonirhat: [25.9923, 89.2847], Nilphamari: [25.931, 88.856], Panchagarh: [26.3411, 88.5542], Thakurgaon: [26.0337, 88.4617],
  Mymensingh: [24.7471, 90.4203], Jamalpur: [24.9375, 89.9378], Netrokona: [24.8709, 90.7279], Sherpur: [25.0205, 90.0153],
}

const AREAS = {
  // Dhaka
  Mirpur: [23.8223, 90.3654], Pallabi: [23.8268, 90.364], Uttara: [23.8759, 90.3795], Dhanmondi: [23.7465, 90.376],
  Gulshan: [23.7925, 90.4078], Banani: [23.794, 90.4043], Baridhara: [23.8017, 90.4205], Mohammadpur: [23.7662, 90.3589],
  Bashundhara: [23.8193, 90.4526], Badda: [23.7807, 90.4267], Rampura: [23.7612, 90.4206], Khilgaon: [23.7516, 90.4275],
  Motijheel: [23.733, 90.4172], Tejgaon: [23.7639, 90.3925], Jatrabari: [23.7104, 90.4349], Savar: [23.8583, 90.2667],
  Keraniganj: [23.6982, 90.348], Farmgate: [23.7577, 90.3897], Malibag: [23.7487, 90.413], Moghbazar: [23.749, 90.4045],
  Azimpur: [23.729, 90.3854], Shyamoli: [23.7744, 90.3654], Agargaon: [23.7781, 90.3772], Vatara: [23.8045, 90.431],
  Khilkhet: [23.8296, 90.42], Cantonment: [23.8223, 90.3943], Lalbag: [23.719, 90.388], Wari: [23.7186, 90.4192],
  Demra: [23.7231, 90.491], Adabor: [23.774, 90.355], Kafrul: [23.792, 90.381], Shahbag: [23.738, 90.395],
  Ramna: [23.74, 90.4], Paltan: [23.736, 90.413], Mugda: [23.73, 90.43], Kalabagan: [23.747, 90.382],
  Hazaribag: [23.735, 90.365], Turag: [23.88, 90.36], Daskhinkhan: [23.86, 90.43], Uttarkhan: [23.885, 90.44],
  Shyampur: [23.69, 90.435], Kamrangirchar: [23.715, 90.37], Darussalam: [23.78, 90.35],
  // Chattogram
  Agrabad: [22.3239, 91.809], Halishahar: [22.3289, 91.7783], Khulshi: [22.3615, 91.8094], Panchlaish: [22.362, 91.824],
  Nasirabad: [22.366, 91.823], GEC: [22.359, 91.8217], Bahaddarhat: [22.367, 91.8445],
  // Sylhet
  Zindabazar: [24.896, 91.869], Amberkhana: [24.905, 91.87], Ambarkhana: [24.905, 91.87], Uposhohor: [24.884, 91.889],
  Tilagor: [24.896, 91.9], Shibganj: [24.889, 91.894],
}

const DISTRICT_BY_KEY = new Map()
Object.entries(DISTRICTS).forEach(([name, point]) => {
  DISTRICT_BY_KEY.set(placeKey(name), point)
  ;(DISTRICT_STORED_SPELLINGS[name] || []).forEach((alias) => DISTRICT_BY_KEY.set(placeKey(alias), point))
})
const AREA_BY_KEY = new Map(Object.entries(AREAS).map(([name, point]) => [placeKey(name), point]))

// The Add Property form used to save this point when no location was picked.
const PLACEHOLDER_POINT = [23.8103, 90.4125]

const isRealPoint = (lat, lng) => {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return false
  // Bangladesh bounding box.
  if (latitude < 20.5 || latitude > 26.8 || longitude < 88 || longitude > 92.8) return false
  return !(Math.abs(latitude - PLACEHOLDER_POINT[0]) < 1e-4 && Math.abs(longitude - PLACEHOLDER_POINT[1]) < 1e-4)
}

const findArea = (...names) => {
  for (const name of names) {
    if (!name) continue
    const direct = AREA_BY_KEY.get(placeKey(name))
    if (direct) return direct
    // "Mirpur 10", "Mirpur-12, Pallabi": try each word group from the left.
    const words = String(name).split(/[\s,/-]+/).filter(Boolean)
    for (let size = Math.min(words.length, 3); size >= 1; size -= 1) {
      const point = AREA_BY_KEY.get(placeKey(words.slice(0, size).join(' ')))
      if (point) return point
    }
  }
  return null
}

/**
 * Where to centre the map for a listing.
 * @returns {{ lat: number, lng: number, precision: 'exact' | 'area' | 'district' } | null}
 */
export function getListingMapLocation({ lat, lng, state_district: district, area, sub_area: subArea } = {}) {
  if (isRealPoint(lat, lng)) {
    return { lat: Number(lat), lng: Number(lng), precision: 'exact' }
  }

  const areaPoint = findArea(subArea, area)
  if (areaPoint) {
    return { lat: areaPoint[0], lng: areaPoint[1], precision: 'area' }
  }

  const districtPoint = DISTRICT_BY_KEY.get(placeKey(String(district || '').trim()))
  if (districtPoint) {
    return { lat: districtPoint[0], lng: districtPoint[1], precision: 'district' }
  }

  return null
}
