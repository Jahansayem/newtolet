// Place-name aliases so Bangla and English queries resolve to the same location, plus the
// spellings that exist in stored listings but not in the location bundle.
import { placeKey } from './normalize.js'

// Bangla -> English name as written in src/thetolet_locations_bundle.json.
const BANGLA_PLACE_NAMES = {
  // Divisions and districts (a division shares its name with its main district).
  ঢাকা: 'Dhaka', চট্টগ্রাম: 'Chattogram', চট্রগ্রাম: 'Chattogram', রাজশাহী: 'Rajshahi', খুলনা: 'Khulna',
  বরিশাল: 'Barishal', সিলেট: 'Sylhet', রংপুর: 'Rangpur', ময়মনসিংহ: 'Mymensingh',
  বরগুনা: 'Barguna', ভোলা: 'Bhola', ঝালকাঠি: 'Jhalokati', পটুয়াখালী: 'Patuakhali', পিরোজপুর: 'Pirojpur',
  বান্দরবান: 'Bandarban', ব্রাহ্মণবাড়িয়া: 'Brahmanbaria', চাঁদপুর: 'Chandpur', কুমিল্লা: 'Comilla',
  কক্সবাজার: "Cox's Bazar", ফেনী: 'Feni', খাগড়াছড়ি: 'Khagrachari', লক্ষ্মীপুর: 'Lakshmipur',
  নোয়াখালী: 'Noakhali', রাঙ্গামাটি: 'Rangamati', রাঙামাটি: 'Rangamati',
  ফরিদপুর: 'Faridpur', গাজীপুর: 'Gazipur', গোপালগঞ্জ: 'Gopalganj', কিশোরগঞ্জ: 'Kishoreganj',
  মাদারীপুর: 'Madaripur', মানিকগঞ্জ: 'Manikganj', মুন্সীগঞ্জ: 'Munshiganj', মুন্সিগঞ্জ: 'Munshiganj',
  নারায়ণগঞ্জ: 'Narayanganj', নারায়নগঞ্জ: 'Narayanganj', নরসিংদী: 'Narsingdi', রাজবাড়ী: 'Rajbari',
  শরীয়তপুর: 'Shariatpur', টাঙ্গাইল: 'Tangail', টাঙাইল: 'Tangail',
  বাগেরহাট: 'Bagerhat', চুয়াডাঙ্গা: 'Chuadanga', যশোর: 'Jessore', ঝিনাইদহ: 'Jhenaidah', কুষ্টিয়া: 'Kushtia',
  মাগুরা: 'Magura', মেহেরপুর: 'Meherpur', নড়াইল: 'Narail', সাতক্ষীরা: 'Satkhira',
  জামালপুর: 'Jamalpur', নেত্রকোণা: 'Netrokona', নেত্রকোনা: 'Netrokona', শেরপুর: 'Sherpur',
  বগুড়া: 'Bogura', চাঁপাইনবাবগঞ্জ: 'Chapainawabganj', জয়পুরহাট: 'Joypurhat', নওগাঁ: 'Naogaon',
  নাটোর: 'Natore', পাবনা: 'Pabna', সিরাজগঞ্জ: 'Sirajganj',
  দিনাজপুর: 'Dinajpur', গাইবান্ধা: 'Gaibandha', কুড়িগ্রাম: 'Kurigram', লালমনিরহাট: 'Lalmonirhat',
  নীলফামারী: 'Nilphamari', পঞ্চগড়: 'Panchagarh', ঠাকুরগাঁও: 'Thakurgaon',
  হবিগঞ্জ: 'Habiganj', মৌলভীবাজার: 'Moulvibazar', সুনামগঞ্জ: 'Sunamganj',
  // Dhaka city areas.
  মিরপুর: 'Mirpur', উত্তরা: 'Uttara', ধানমন্ডি: 'Dhanmondi', ধানমণ্ডি: 'Dhanmondi', গুলশান: 'Gulshan',
  বনানী: 'Banani', মোহাম্মদপুর: 'Mohammadpur', বসুন্ধরা: 'Bashundhara', বাড্ডা: 'Badda', রামপুরা: 'Rampura',
  খিলগাঁও: 'Khilgaon', মতিঝিল: 'Motijheel', তেজগাঁও: 'Tejgaon', যাত্রাবাড়ী: 'Jatrabari', ডেমরা: 'Demra',
  সাভার: 'Savar', কেরানীগঞ্জ: 'Keraniganj', পল্লবী: 'Pallabi', কাফরুল: 'Kafrul', ক্যান্টনমেন্ট: 'Cantonment',
  লালবাগ: 'Lalbag', হাজারীবাগ: 'Hazaribag', ওয়ারী: 'Wari', শ্যামপুর: 'Shyampur', খিলক্ষেত: 'Khilkhet',
  ভাটারা: 'Vatara', আদাবর: 'Adabor', শাহবাগ: 'Shahbag', রমনা: 'Ramna', পল্টন: 'Paltan', কলাবাগান: 'Kalabagan',
  মুগদা: 'Mugda', সবুজবাগ: 'Sabujbag', তুরাগ: 'Turag', উত্তরখান: 'Uttarkhan', দক্ষিণখান: 'Daskhinkhan',
  গেন্ডারিয়া: 'Gandaria', কামরাঙ্গীরচর: 'Kamrangirchar', দারুসসালাম: 'Darussalam', শাহআলী: 'Shah Ali',
  ধামরাই: 'Dhamrai', পূর্বাচল: 'Purbachal', ভাষানটেক: 'Bhashantek', নিউমার্কেট: 'New Market',
  কোতোয়ালী: 'Kotwali', কোতয়ালী: 'Kotwali', শাহজাহানপুর: 'Shahjahanpur', মালিবাগ: 'Malibag', মগবাজার: 'Moghbazar',
  ফার্মগেট: 'Farmgate', আজিমপুর: 'Azimpur', শ্যামলী: 'Shyamoli', আগারগাঁও: 'Agargaon', কল্যাণপুর: 'Kallyanpur',
  // Other city areas common in listings.
  জিন্দাবাজার: 'Zindabazar', আম্বরখানা: 'Amberkhana', উপশহর: 'Uposhohor', টিলাগড়: 'Tilagor',
  আগ্রাবাদ: 'Agrabad', হালিশহর: 'Halishahar', খুলশী: 'Khulshi', পাঁচলাইশ: 'Panchlaish', নাসিরাবাদ: 'Nasirabad',
  চকবাজার: 'Chawkbazar', বহদ্দারহাট: 'Bahaddarhat', সদর: 'Sadar',
}

// Alternative English spellings typed by users -> bundle spelling.
const ENGLISH_SPELLINGS = {
  chittagong: 'Chattogram', ctg: 'Chattogram', chattagram: 'Chattogram',
  barisal: 'Barishal', bogra: 'Bogura', jashore: 'Jessore', cumilla: 'Comilla',
  maulvibazar: 'Moulvibazar', moulvibaza: 'Moulvibazar', coxbazar: "Cox's Bazar", coxsbazar: "Cox's Bazar",
  chapainawabgonj: 'Chapainawabganj', chapai: 'Chapainawabganj', netrakona: 'Netrokona',
  jhalakathi: 'Jhalokati', jhalokathi: 'Jhalokati', dakshinkhan: 'Daskhinkhan', dakkhinkhan: 'Daskhinkhan',
  muhammadpur: 'Mohammadpur', mohammedpur: 'Mohammadpur', dhanmondhi: 'Dhanmondi',
  bashundhararesidentialarea: 'Bashundhara', bosundhora: 'Bashundhara', motijhil: 'Motijheel',
  khilgaon: 'Khilgaon', tejgaon: 'Tejgaon', narayangonj: 'Narayanganj', gazipur: 'Gazipur',
}

// Stored spellings of a district that differ from the bundle (seen in live data). Used to widen
// SQL matches so "Chattogram" also finds rows saved as "Chittagong".
export const DISTRICT_STORED_SPELLINGS = Object.freeze({
  Chattogram: ['Chittagong', 'Ctg'],
  Barishal: ['Barisal'],
  Bogura: ['Bogra'],
  Jessore: ['Jashore'],
  Comilla: ['Cumilla'],
  Moulvibazar: ['Maulvibazar', 'Moulvi Bazar', 'Moulvibaza'],
  "Cox's Bazar": ['Coxs Bazar', 'Cox Bazar'],
  Chapainawabganj: ['Chapai Nawabganj', 'Chapainababganj'],
  Netrokona: ['Netrakona'],
  Jhalokati: ['Jhalakathi', 'Jhalokathi'],
})

// Well-known neighbourhoods that the bundle lacks or only has under a longer name
// ("Bashundhara R.A"). Listings store the short name, so search it within its district.
const AREA_DISTRICT_HINTS = {
  Bashundhara: 'Dhaka', Farmgate: 'Dhaka', Malibag: 'Dhaka', Moghbazar: 'Dhaka', Azimpur: 'Dhaka',
  Shyamoli: 'Dhaka', Agargaon: 'Dhaka', Kallyanpur: 'Dhaka', Baridhara: 'Dhaka', Niketan: 'Dhaka',
  Zindabazar: 'Sylhet', Amberkhana: 'Sylhet', Uposhohor: 'Sylhet', Tilagor: 'Sylhet', Shibganj: 'Sylhet',
  Agrabad: 'Chattogram', Halishahar: 'Chattogram', Khulshi: 'Chattogram', Panchlaish: 'Chattogram',
  Nasirabad: 'Chattogram', Bahaddarhat: 'Chattogram', GEC: 'Chattogram',
}
const AREA_HINT_BY_KEY = new Map(Object.entries(AREA_DISTRICT_HINTS).map(([name, district]) => [placeKey(name), { name, district }]))

/** { name, district } for a neighbourhood hint, else null. */
export const areaHint = (englishOrKey = '') => AREA_HINT_BY_KEY.get(placeKey(englishOrKey)) || null

const BANGLA_BY_KEY = new Map(Object.entries(BANGLA_PLACE_NAMES).map(([bangla, english]) => [placeKey(bangla), english]))
const ENGLISH_BY_KEY = new Map(Object.entries(ENGLISH_SPELLINGS).map(([alias, english]) => [placeKey(alias), english]))

/** English bundle name for a Bangla or alternative-spelling place word, else ''. */
export const placeAlias = (text = '') => {
  const key = placeKey(text)
  return BANGLA_BY_KEY.get(key) || ENGLISH_BY_KEY.get(key) || ''
}

// Words that are not a place and carry no filter: dropped from keyword matching.
const STOPWORDS = new Set([
  'rent', 'rental', 'rents', 'for', 'in', 'at', 'near', 'the', 'a', 'an', 'to', 'let', 'tolet', 'house',
  'home', 'property', 'properties', 'available', 'vara', 'bhara', 'basa', 'bari', 'and', 'with', 'of',
  'বাসা', 'ভাড়া', 'ভারা', 'টুলেট', 'টু', 'লেট', 'জন্য', 'এ', 'এর', 'ও', 'বাড়ি', 'বাড়ী', 'খালি',
])

export const isStopword = (token = '') => STOPWORDS.has(token)

// Query words that mean a structured filter rather than free text.
const WORD_FILTERS = {
  family: { category: 'Family' }, ফ্যামিলি: { category: 'Family' }, পরিবার: { category: 'Family' }, পারিবারিক: { category: 'Family' },
  bachelor: { category: 'Bachelor' }, bachelors: { category: 'Bachelor' }, ব্যাচেলর: { category: 'Bachelor' },
  sublet: { category: 'Sublet' }, সাবলেট: { category: 'Sublet' },
  hostel: { category: 'Hostel' }, mess: { category: 'Hostel' }, হোস্টেল: { category: 'Hostel' }, মেস: { category: 'Hostel' },
  office: { category: 'Office' }, অফিস: { category: 'Office' },
  shop: { category: 'Shop' }, দোকান: { category: 'Shop' },
  flat: { propertyType: 'Apartment' }, flats: { propertyType: 'Apartment' }, apartment: { propertyType: 'Apartment' },
  ফ্ল্যাট: { propertyType: 'Apartment' }, ফ্লাট: { propertyType: 'Apartment' },
  room: { propertyType: 'Room' }, rooms: { propertyType: 'Room' }, রুম: { propertyType: 'Room' }, কক্ষ: { propertyType: 'Room' },
  lift: { amenity: 'lift' }, elevator: { amenity: 'lift' }, লিফট: { amenity: 'lift' },
  generator: { amenity: 'generator' }, জেনারেটর: { amenity: 'generator' },
  gas: { amenity: 'gas' }, গ্যাস: { amenity: 'gas' },
  parking: { amenity: 'parking' }, garage: { amenity: 'parking' }, পার্কিং: { amenity: 'parking' }, গ্যারেজ: { amenity: 'parking' },
  furnished: { amenity: 'furnished' }, ফার্নিশড: { amenity: 'furnished' },
  female: { occupancy: 'female' }, ladies: { occupancy: 'female' }, girls: { occupancy: 'female' },
  মহিলা: { occupancy: 'female' }, ছাত্রী: { occupancy: 'female' },
}

export const wordFilter = (token = '') => WORD_FILTERS[token] || null
