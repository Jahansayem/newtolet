// Bangladesh Administrative Divisions, Districts, and Areas
// Complete hierarchical location data

// All 8 Divisions of Bangladesh
export const divisions = [
    'Barishal',
    'Chattogram',
    'Dhaka',
    'Khulna',
    'Mymensingh',
    'Rajshahi',
    'Rangpur',
    'Sylhet'
];

// All 64 Districts mapped to their Divisions
export const districts = {
    'Barishal': [
        'Barishal',
        'Barguna',
        'Bhola',
        'Jhalokati',
        'Patuakhali',
        'Pirojpur'
    ],
    'Chattogram': [
        'Chattogram',
        'Bandarban',
        'Brahmanbaria',
        'Chandpur',
        'Comilla',
        "Cox's Bazar",
        'Feni',
        'Khagrachhari',
        'Lakshmipur',
        'Noakhali',
        'Rangamati'
    ],
    'Dhaka': [
        'Dhaka',
        'Faridpur',
        'Gazipur',
        'Gopalganj',
        'Kishoreganj',
        'Madaripur',
        'Manikganj',
        'Munshiganj',
        'Narayanganj',
        'Narsingdi',
        'Rajbari',
        'Shariatpur',
        'Tangail'
    ],
    'Khulna': [
        'Khulna',
        'Bagerhat',
        'Chuadanga',
        'Jessore',
        'Jhenaidah',
        'Kushtia',
        'Magura',
        'Meherpur',
        'Narail',
        'Satkhira'
    ],
    'Mymensingh': [
        'Mymensingh',
        'Jamalpur',
        'Netrokona',
        'Sherpur'
    ],
    'Rajshahi': [
        'Rajshahi',
        'Bogra',
        'Chapainawabganj',
        'Joypurhat',
        'Naogaon',
        'Natore',
        'Nawabganj',
        'Pabna',
        'Sirajganj'
    ],
    'Rangpur': [
        'Rangpur',
        'Dinajpur',
        'Gaibandha',
        'Kurigram',
        'Lalmonirhat',
        'Nilphamari',
        'Panchagarh',
        'Thakurgaon'
    ],
    'Sylhet': [
        'Sylhet',
        'Habiganj',
        'Moulvibazar',
        'Sunamganj'
    ]
};

// Upazilas/Areas for each District (Sadar + major areas)
export const areas = {
    // Barishal Division
    'Barishal': ['Barishal Sadar', 'Bakerganj', 'Banaripara', 'Gaurnadi', 'Hizla', 'Mehendiganj', 'Muladi', 'Wazirpur', 'Agailjhara', 'Babuganj'],
    'Barguna': ['Barguna Sadar', 'Amtali', 'Bamna', 'Betagi', 'Patharghata', 'Taltali'],
    'Bhola': ['Bhola Sadar', 'Burhanuddin', 'Char Fasson', 'Daulatkhan', 'Lalmohan', 'Manpura', 'Tazumuddin'],
    'Jhalokati': ['Jhalokati Sadar', 'Kathalia', 'Nalchity', 'Rajapur'],
    'Patuakhali': ['Patuakhali Sadar', 'Bauphal', 'Dashmina', 'Dumki', 'Galachipa', 'Kalapara', 'Mirzaganj', 'Rangabali'],
    'Pirojpur': ['Pirojpur Sadar', 'Bhandaria', 'Kawkhali', 'Mathbaria', 'Nazirpur', 'Nesarabad', 'Zianagar'],

    // Chattogram Division
    'Chattogram': ['Chattogram Sadar', 'Anwara', 'Banshkhali', 'Boalkhali', 'Chandanaish', 'Fatikchhari', 'Hathazari', 'Karnaphuli', 'Lohagara', 'Mirsharai', 'Patiya', 'Rangunia', 'Raozan', 'Sandwip', 'Satkania', 'Sitakunda', 'Agrabad', 'Nasirabad', 'Khulshi', 'Panchlaish', 'GEC Circle'],
    'Bandarban': ['Bandarban Sadar', 'Alikadam', 'Lama', 'Naikhongchhari', 'Rowangchhari', 'Ruma', 'Thanchi'],
    'Brahmanbaria': ['Brahmanbaria Sadar', 'Akhaura', 'Ashuganj', 'Bancharampur', 'Bijoynagar', 'Kasba', 'Nabinagar', 'Nasirnagar', 'Sarail'],
    'Chandpur': ['Chandpur Sadar', 'Faridganj', 'Haimchar', 'Haziganj', 'Kachua', 'Matlab Dakshin', 'Matlab Uttar', 'Shahrasti'],
    'Comilla': ['Comilla Sadar', 'Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Daudkandi', 'Debidwar', 'Homna', 'Laksam', 'Lalmai', 'Meghna', 'Monohorgonj', 'Muradnagar', 'Nangalkot', 'Titas'],
    "Cox's Bazar": ["Cox's Bazar Sadar", 'Chakaria', 'Kutubdia', 'Maheshkhali', 'Pekua', 'Ramu', 'Teknaf', 'Ukhia', 'Inani Beach', 'Laboni Beach'],
    'Feni': ['Feni Sadar', 'Chhagalnaiya', 'Daganbhuiyan', 'Fulgazi', 'Parshuram', 'Sonagazi'],
    'Khagrachhari': ['Khagrachhari Sadar', 'Dighinala', 'Guimara', 'Lakshmichhari', 'Mahalchhari', 'Manikchhari', 'Matiranga', 'Panchhari', 'Ramgarh'],
    'Lakshmipur': ['Lakshmipur Sadar', 'Kamalnagar', 'Raipur', 'Ramganj', 'Ramgati'],
    'Noakhali': ['Noakhali Sadar', 'Begumganj', 'Chatkhil', 'Companiganj', 'Hatiya', 'Kabirhat', 'Senbagh', 'Sonaimuri', 'Subarnachar'],
    'Rangamati': ['Rangamati Sadar', 'Bagaichhari', 'Barkal', 'Belaichhari', 'Juraichhari', 'Kaptai', 'Kawkhali', 'Langadu', 'Naniarchar', 'Rajasthali'],

    // Dhaka Division
    'Dhaka': ['Dhaka Sadar', 'Dhamrai', 'Dohar', 'Keraniganj', 'Nawabganj', 'Savar', 'Dhanmondi', 'Gulshan', 'Banani', 'Uttara', 'Mirpur', 'Mohammadpur', 'Motijheel', 'Tejgaon', 'Badda', 'Khilgaon', 'Rampura', 'Bashundhara', 'Baridhara', 'Paltan', 'Puran Dhaka', 'Lalmatia', 'Shyamoli', 'Farmgate', 'Elephant Road'],
    'Faridpur': ['Faridpur Sadar', 'Alfadanga', 'Bhanga', 'Boalmari', 'Charbhadrasan', 'Madhukhali', 'Nagarkanda', 'Sadarpur', 'Saltha'],
    'Gazipur': ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur', 'Tongi', 'Joydebpur', 'Board Bazar', 'Chowrasta'],
    'Gopalganj': ['Gopalganj Sadar', 'Kashiani', 'Kotalipara', 'Muksudpur', 'Tungipara'],
    'Kishoreganj': ['Kishoreganj Sadar', 'Austagram', 'Bajitpur', 'Bhairab', 'Hossainpur', 'Itna', 'Karimganj', 'Katiadi', 'Kuliarchar', 'Mithamain', 'Nikli', 'Pakundia', 'Tarail'],
    'Madaripur': ['Madaripur Sadar', 'Kalkini', 'Rajoir', 'Shibchar', 'Dasar'],
    'Manikganj': ['Manikganj Sadar', 'Daulatpur', 'Ghior', 'Harirampur', 'Saturia', 'Shivalaya', 'Singair'],
    'Munshiganj': ['Munshiganj Sadar', 'Gazaria', 'Lohajang', 'Sirajdikhan', 'Sreenagar', 'Tongibari'],
    'Narayanganj': ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon', 'Fatullah', 'Siddhirganj'],
    'Narsingdi': ['Narsingdi Sadar', 'Belabo', 'Monohardi', 'Palash', 'Raipura', 'Shibpur'],
    'Rajbari': ['Rajbari Sadar', 'Baliakandi', 'Goalanda', 'Kalukhali', 'Pangsha'],
    'Shariatpur': ['Shariatpur Sadar', 'Bhedarganj', 'Damudya', 'Gosairhat', 'Naria', 'Zajira'],
    'Tangail': ['Tangail Sadar', 'Basail', 'Bhuapur', 'Delduar', 'Dhanbari', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Mirzapur', 'Nagarpur', 'Sakhipur'],

    // Khulna Division
    'Khulna': ['Khulna Sadar', 'Batiaghata', 'Dacope', 'Dighalia', 'Dumuria', 'Koyra', 'Paikgachha', 'Phultala', 'Rupsa', 'Terokhada', 'Sonadanga', 'Khalishpur', 'Daulatpur'],
    'Bagerhat': ['Bagerhat Sadar', 'Chitalmari', 'Fakirhat', 'Kachua', 'Mollahat', 'Mongla', 'Morrelganj', 'Rampal', 'Sarankhola'],
    'Chuadanga': ['Chuadanga Sadar', 'Alamdanga', 'Damurhuda', 'Jibannagar'],
    'Jessore': ['Jessore Sadar', 'Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha'],
    'Jhenaidah': ['Jhenaidah Sadar', 'Harinakunda', 'Kaliganj', 'Kotchandpur', 'Maheshpur', 'Shailkupa'],
    'Kushtia': ['Kushtia Sadar', 'Bheramara', 'Daulatpur', 'Khoksa', 'Kumarkhali', 'Mirpur'],
    'Magura': ['Magura Sadar', 'Mohammadpur', 'Shalikha', 'Sreepur'],
    'Meherpur': ['Meherpur Sadar', 'Gangni', 'Mujibnagar'],
    'Narail': ['Narail Sadar', 'Kalia', 'Lohagara'],
    'Satkhira': ['Satkhira Sadar', 'Assasuni', 'Debhata', 'Kalaroa', 'Kaliganj', 'Shyamnagar', 'Tala'],

    // Mymensingh Division
    'Mymensingh': ['Mymensingh Sadar', 'Bhaluka', 'Dhobaura', 'Fulbaria', 'Gaffargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Nandail', 'Phulpur', 'Trishal', 'Tarakanda'],
    'Jamalpur': ['Jamalpur Sadar', 'Bakshiganj', 'Dewanganj', 'Islampur', 'Madarganj', 'Melandaha', 'Sarishabari'],
    'Netrokona': ['Netrokona Sadar', 'Atpara', 'Barhatta', 'Durgapur', 'Kalmakanda', 'Kendua', 'Khaliajuri', 'Madan', 'Mohanganj', 'Purbadhala'],
    'Sherpur': ['Sherpur Sadar', 'Jhenaigati', 'Nakla', 'Nalitabari', 'Sreebardi'],

    // Rajshahi Division
    'Rajshahi': ['Rajshahi Sadar', 'Bagha', 'Bagmara', 'Charghat', 'Durgapur', 'Godagari', 'Mohanpur', 'Paba', 'Puthia', 'Tanore', 'Shaheb Bazar', 'Upashahar', 'Kazla'],
    'Bogra': ['Bogra Sadar', 'Adamdighi', 'Dhunat', 'Dhupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakandi', 'Shajahanpur', 'Sherpur', 'Shibganj', 'Sonatola'],
    'Chapainawabganj': ['Chapainawabganj Sadar', 'Bholahat', 'Gomastapur', 'Nachole', 'Shibganj'],
    'Joypurhat': ['Joypurhat Sadar', 'Akkelpur', 'Kalai', 'Khetlal', 'Panchbibi'],
    'Naogaon': ['Naogaon Sadar', 'Atrai', 'Badalgachhi', 'Dhamoirhat', 'Manda', 'Mahadebpur', 'Niamatpur', 'Patnitala', 'Porsha', 'Raninagar', 'Sapahar'],
    'Natore': ['Natore Sadar', 'Bagatipara', 'Baraigram', 'Gurudaspur', 'Lalpur', 'Singra'],
    'Nawabganj': ['Nawabganj Sadar', 'Bholahat', 'Gomastapur', 'Nachole', 'Shibganj'],
    'Pabna': ['Pabna Sadar', 'Atgharia', 'Bera', 'Bhangura', 'Chatmohar', 'Faridpur', 'Ishwardi', 'Santhia', 'Sujanagar'],
    'Sirajganj': ['Sirajganj Sadar', 'Belkuchi', 'Chauhali', 'Kamarkhanda', 'Kazipur', 'Raiganj', 'Shahjadpur', 'Tarash', 'Ullahpara'],

    // Rangpur Division
    'Rangpur': ['Rangpur Sadar', 'Badarganj', 'Gangachara', 'Kaunia', 'Mithapukur', 'Pirgachha', 'Pirganj', 'Taraganj', 'Modern More', 'Central Road', 'Jahaj Company More'],
    'Dinajpur': ['Dinajpur Sadar', 'Birampur', 'Birganj', 'Biral', 'Bochaganj', 'Chirirbandar', 'Fulbari', 'Ghoraghat', 'Hakimpur', 'Kaharole', 'Khansama', 'Nawabganj', 'Parbatipur'],
    'Gaibandha': ['Gaibandha Sadar', 'Fulchhari', 'Gobindaganj', 'Palashbari', 'Sadullapur', 'Saghatta', 'Sundarganj'],
    'Kurigram': ['Kurigram Sadar', 'Bhurungamari', 'Char Rajibpur', 'Chilmari', 'Nageshwari', 'Phulbari', 'Rajarhat', 'Raumari', 'Ulipur'],
    'Lalmonirhat': ['Lalmonirhat Sadar', 'Aditmari', 'Hatibandha', 'Kaliganj', 'Patgram'],
    'Nilphamari': ['Nilphamari Sadar', 'Dimla', 'Domar', 'Jaldhaka', 'Kishoreganj', 'Saidpur'],
    'Panchagarh': ['Panchagarh Sadar', 'Atwari', 'Boda', 'Debiganj', 'Tetulia'],
    'Thakurgaon': ['Thakurgaon Sadar', 'Baliadangi', 'Haripur', 'Pirganj', 'Ranisankail'],

    // Sylhet Division
    'Sylhet': ['Sylhet Sadar', 'Balaganj', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Dakshin Surma', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Osmani Nagar', 'Zakiganj', 'Zindabazar', 'Amberkhana', 'Bandarbazar', 'Uposhohor'],
    'Habiganj': ['Habiganj Sadar', 'Ajmiriganj', 'Bahubal', 'Baniyachong', 'Chunarughat', 'Lakhai', 'Madhabpur', 'Nabiganj', 'Shayestaganj'],
    'Moulvibazar': ['Moulvibazar Sadar', 'Barlekha', 'Juri', 'Kamalganj', 'Kulaura', 'Rajnagar', 'Sreemangal'],
    'Sunamganj': ['Sunamganj Sadar', 'Bishwamvarpur', 'Chhatak', 'Dakshin Sunamganj', 'Derai', 'Dharmapasha', 'Dowarabazar', 'Jagannathpur', 'Jamalganj', 'Sulla', 'Tahirpur']
};

// Sub-areas (major localities within areas) - only for major urban areas
// Rural areas will not show sub-area dropdown
export const subAreas = {
    // ==================== DHAKA DIVISION ====================
    // Dhaka City Areas (with detailed sub-areas)
    'Dhanmondi': ['Road 1', 'Road 2', 'Road 3', 'Road 4', 'Road 5', 'Road 6', 'Road 7', 'Road 8', 'Road 9', 'Road 10', 'Road 11', 'Road 12', 'Road 13', 'Road 14', 'Road 15', 'Road 27', 'Road 28', 'Road 32', 'Satmasjid Road', 'Shankar', 'Jigatola', 'Kalabagan', 'Science Lab'],
    'Gulshan': ['Gulshan 1', 'Gulshan 2', 'Niketan', 'North Gulshan', 'South Gulshan', 'Gulshan Circle 1', 'Gulshan Circle 2', 'Baridhara'],
    'Banani': ['Banani Road 1', 'Banani Road 11', 'Banani DOHS', 'Chairman Bari', 'Kemal Ataturk Avenue', 'Banani Model Town'],
    'Baridhara': ['Baridhara DOHS', 'Diplomatic Zone'],
    'Uttara': ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6', 'Sector 7', 'Sector 8', 'Sector 9', 'Sector 10', 'Sector 11', 'Sector 12', 'Sector 13', 'Sector 14', 'Diabari', 'Azampur', 'Jasimuddin Road', 'Rajlokkhi'],
    'Mirpur': ['Mirpur 1', 'Mirpur 2', 'Mirpur 6', 'Mirpur 10', 'Mirpur 11', 'Mirpur 12', 'Mirpur 13', 'Mirpur 14', 'Pallabi', 'Kazipara', 'Shewrapara', 'Pirerbag', 'Sony Cinema Hall', 'Technical'],
    'Mohammadpur': ['Town Hall', 'Mohammadia Housing', 'Japan Garden City', 'PC Culture Housing', 'Nurjahan Road', 'Tajmahal Road', 'Iqbal Road', 'Asad Gate', 'Ring Road', 'Shankar', 'Adabor'],
    'Motijheel': ['Shapla Chattar', 'Dilkusha', 'Fakirapool', 'Kamalapur', 'Arambagh', 'Tikatuli', 'North South Road'],
    'Tejgaon': ['Tejgaon Industrial Area', 'Farmgate', 'Bijoy Sarani', 'Bangla Motor', 'Karwan Bazar', 'Tejkunipara', 'Nakhalpara'],
    'Badda': ['Middle Badda', 'North Badda', 'South Badda', 'Uttar Badda', 'Merul Badda', 'Shahjadpur', 'Aftab Nagar'],
    'Bashundhara': ['Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Block F', 'Block G', 'Block H', 'Block I', 'Block J', 'Block K', 'R/A'],
    'Rampura': ['Rampura Bazar', 'Banasree', 'Uttar Khan', 'Madhubag'],
    'Khilgaon': ['Khilgaon Rail Gate', 'Taltola', 'Bashabo', 'Malibagh'],
    'Bashabo': ['East Bashabo', 'West Bashabo', 'South Bashabo'],
    'Malibagh': ['Malibagh Rail Gate', 'Malibagh Bazar', 'Mouchak'],
    'Moghbazar': ['Moghbazar Wireless', 'Moghbazar Crossing', 'Kakrail'],
    'Cantonment': ['Cantonment Bazar', 'Dhaka Cantonment', 'Baipail'],
    'Paltan': ['Paltan Maidan', 'Topkhana Road', 'Bijoynagar'],
    'Ramna': ['Ramna Park', 'Suhrawardy Udyan', 'Doyel Chattar'],
    'Shahjahanpur': ['Shahjahanpur Bazar', 'Kakrail'],

    // Chattogram City Areas
    'Agrabad': ['Agrabad Commercial Area', 'Agrabad Access Road', 'CDA Avenue', 'Nur Ahmed Road', 'Wasa Road', 'Jamal Khan', 'Zohora Square'],
    'Nasirabad': ['Nasirabad Housing', 'CDA R/A', 'Zakir Hossain Road', 'East Nasirabad'],
    'Khulshi': ['Khulshi Road', 'Khulshi R/A', 'Tiger Pass', 'Mehedibag'],
    'GEC Circle': ['GEC More', 'Bahaddarhat', 'Oxygen More', 'Muradpur'],
    'Halishahar': ['Halishahar', 'C/E', 'Port Connecting Road'],
    'Kattali': ['Kattali', 'Muradpur', 'Khulshi'],
    'Pahartali': ['Pahartali', 'Bayezid', 'Agrabad'],
    'Chawkbazar': ['Chawkbazar', 'Andarkilla', 'Chattogram Sadar'],

    // Sylhet City Areas
    'Sylhet Sadar': ['Zindabazar Main Road', 'Court Point', 'Bondor Bazar', 'Mirabazar', 'Ambarkhana', 'Subid Bazar', 'Modina Market', 'Shahjalal University Gate'],
    'Zindabazar': ['Zindabazar Main Road', 'Court Point', 'Bondor Bazar', 'Mirabazar'],
    'Amberkhana': ['Amberkhana Point', 'Subid Bazar', 'Modina Market', 'Shah Jalal Upashahar'],
    'Uposhohor': ['Housing Estate', 'Medical Road', 'Shahjalal University Gate', 'Temukhi'],

    // Cox's Bazar Areas
    "Cox's Bazar Sadar": ["Cox's Bazar Town", 'Laboni Point', 'Kolatoli', 'Sugandha', 'Inani Beach', 'Laboni Beach'],

    // Moulvibazar Town Areas
    'Moulvibazar Sadar': ['Saifur Rahman Road', 'Court Road', 'Choumohona', 'Borohat', 'Kalighat', 'College Road', 'Stadium Road', 'Central Road', 'Sherpur Road', 'Kusumbag', 'Shah Mostafa Road', 'Town Hall Area'],

    // Sreemangal Town Areas
    'Sreemangal': ['Radhanagar', 'Shahibag', 'College Road Area', 'Station Road', 'BTRI Area', 'Ramnagar', 'Bharaura', 'Khaichhara', 'Muslimbag', 'Shaplabag', 'Shantinagar'],
    // Bogra District
    'Dhunat': ['Dhunat Bazar', 'Bogra', 'Adamdighi'],
    'Dhupchanchia': ['Dhupchanchia Bazar', 'Bogra', 'Gabtali'],
    'Gabtali': ['Gabtali Bazar', 'Bogra', 'Sherpur'],
    'Kahaloo': ['Kahaloo Bazar', 'Bogra', 'Sherpur'],
    'Nandigram': ['Nandigram Bazar', 'Bogra', 'Sariakandi'],
    'Sariakandi': ['Sariakandi Bazar', 'Bogra', 'Nandigram'],
    'Shajahanpur': ['Shajahanpur Bazar', 'Bogra', 'Sherpur'],
    'Sherpur': ['Sherpur Bazar', 'Bogra', 'Shajahanpur'],
    'Shibganj': ['Shibganj Bazar', 'Bogra', 'Sariakandi'],
    'Sonatola': ['Sonatola Bazar', 'Bogra', 'Dhupchanchia'],

    // Chapainawabganj District
    'Chapainawabganj Sadar': ['Chapainawabganj Town', 'Sadar', 'Shibganj'],
    'Gomastapur': ['Gomastapur Bazar', 'Chapainawabganj', 'Bholahat'],
    'Manda': ['Manda Bazar', 'Chapainawabganj', 'Nawabganj'],
    'Nawabganj': ['Nawabganj Bazar', 'Chapainawabganj', 'Manda'],
    'Shibganj': ['Shibganj Bazar', 'Chapainawabganj', 'Gomastapur'],
    'Bholahat': ['Bholahat Bazar', 'Chapainawabganj', 'Gomastapur'],

    // Joypurhat District
    'Joypurhat Sadar': ['Joypurhat Town', 'Sadar', 'Panchbibi'],
    'Akkelpur': ['Akkelpur Bazar', 'Joypurhat', 'Kalai'],
    'Kalai': ['Kalai Bazar', 'Joypurhat', 'Akkelpur'],
    'Khetlal': ['Khetlal Bazar', 'Joypurhat', 'Panchbibi'],
    'Panchbibi': ['Panchbibi Bazar', 'Joypurhat', 'Khetlal'],

    // Naogaon District
    'Naogaon Sadar': ['Naogaon Town', 'Sadar', 'Manda'],
    'Badalgachhi': ['Badalgachhi Bazar', 'Naogaon', 'Sapahar'],
    'Dhamoirhat': ['Dhamoirhat Bazar', 'Naogaon', 'Gobindaganj'],
    'Mohadevpur': ['Mohadevpur Bazar', 'Naogaon', 'Patnitala'],
    'Manda': ['Manda Bazar', 'Naogaon', 'Nawabganj'],
    'Niamatpur': ['Niamatpur Bazar', 'Naogaon', 'Manda'],
    'Patnitala': ['Patnitala Bazar', 'Naogaon', 'Mohadevpur'],
    'Porsha': ['Porsha Bazar', 'Naogaon', 'Rajshahi'],
    'Raninagar': ['Raninagar Bazar', 'Naogaon', 'Atrai'],
    'Sapahar': ['Sapahar Bazar', 'Naogaon', 'Badalgachhi'],
    'Atrai': ['Atrai Bazar', 'Naogaon', 'Raninagar'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Naogaon', 'Dhamoirhat'],

    // Natore District
    'Natore Sadar': ['Natore Town', 'Sadar', 'Singra'],
    'Baraigram': ['Baraigram Bazar', 'Natore', 'Gurudaspur'],
    'Bagatipara': ['Bagatipara Bazar', 'Natore', 'Lalpur'],
    'Gurudaspur': ['Gurudaspur Bazar', 'Natore', 'Baraigram'],
    'Lalpur': ['Lalpur Bazar', 'Natore', 'Bagatipara'],
    'Singra': ['Singra Bazar', 'Natore', 'Baraigram'],
    'Naldanga': ['Naldanga Bazar', 'Natore', 'Sadar'],

    // Nawabganj District
    'Nawabganj Sadar': ['Nawabganj Town', 'Sadar', 'Shibganj'],
    'Bholahat': ['Bholahat Bazar', 'Nawabganj', 'Gomastapur'],
    'Gomastapur': ['Gomastapur Bazar', 'Nawabganj', 'Bholahat'],
    'Nachole': ['Nachole Bazar', 'Nawabganj', 'Niamatpur'],
    'Niamatpur': ['Niamatpur Bazar', 'Nawabganj', 'Nachole'],
    'Shibganj': ['Shibganj Bazar', 'Nawabganj', 'Bholahat'],

    // Pabna District
    'Pabna Sadar': ['Pabna Town', 'Sadar', 'Ishwardi'],
    'Atgharia': ['Atgharia Bazar', 'Pabna', 'Sujanagar'],
    'Bera': ['Bera Bazar', 'Pabna', 'Sathia'],
    'Bhangura': ['Bhangura Bazar', 'Pabna', 'Faridpur'],
    'Chatmohar': ['Chatmohar Bazar', 'Pabna', 'Faridpur'],
    'Faridpur': ['Faridpur Bazar', 'Pabna', 'Chatmohar'],
    'Ishwardi': ['Ishwardi Bazar', 'Pabna', 'Pabna Sadar'],
    'Santhia': ['Santhia Bazar', 'Pabna', 'Bhangura'],
    'Sathia': ['Sathia Bazar', 'Pabna', 'Bera'],
    'Sujanagar': ['Sujanagar Bazar', 'Pabna', 'Atgharia'],

    // Sirajganj District
    'Sirajganj Sadar': ['Sirajganj Town', 'Sadar', 'Belkuchi'],
    'Belkuchi': ['Belkuchi Bazar', 'Sirajganj', 'Kazipur'],
    'Chauhali': ['Chauhali Bazar', 'Sirajganj', 'Shahjadpur'],
    'Enayetpur': ['Enayetpur Bazar', 'Sirajganj', 'Ullapara'],
    'Kazipur': ['Kazipur Bazar', 'Sirajganj', 'Belkuchi'],
    'Kamarkhand': ['Kamarkhand Bazar', 'Sirajganj', 'Sadar'],
    'Raiganj': ['Raiganj Bazar', 'Sirajganj', 'Shahjadpur'],
    'Shahjadpur': ['Shahjadpur Bazar', 'Sirajganj', 'Raiganj'],
    'Sirajganj Sadar': ['Sirajganj Town', 'Raiganj', 'Tarash'],
    'Tarash': ['Tarash Bazar', 'Sirajganj', 'Ullapara'],
    'Ullapara': ['Ullapara Bazar', 'Sirajganj', 'Enayetpur'],

    // ==================== KHULNA DIVISION ====================
    // Khulna District
    'Khulna Sadar': ['Khulna Town', 'Sadar', 'Sonadanga'],
    'Batiaghata': ['Batiaghata Bazar', 'Khulna', 'Dacope'],
    'Dacope': ['Dacope Bazar', 'Khulna', 'Koyra'],
    'Dighalia': ['Dighalia Bazar', 'Khulna', 'Batighata'],
    'Dumuria': ['Dumuria Bazar', 'Khulna', 'Phultala'],
    'Koyra': ['Koyra Bazar', 'Khulna', 'Paikgachha'],
    'Paikgachha': ['Paikgachha Bazar', 'Khulna', 'Koyra'],
    'Phultala': ['Phultala Bazar', 'Khulna', 'Terokhada'],
    'Rupsa': ['Rupsa Bazar', 'Khulna', 'Terokhada'],
    'Terokhada': ['Terokhada Bazar', 'Khulna', 'Rupsa'],
    'Sonadanga': ['Sonadanga Bazar', 'Khulna', 'Khalishpur'],
    'Khalishpur': ['Khalishpur', 'Khulna', 'Daulatpur'],
    'Daulatpur': ['Daulatpur', 'Khulna', 'Shibbari'],
    'Shibbari': ['Shibbari', 'Khulna', 'Atra Gile'],

    // Bagerhat District
    'Bagerhat Sadar': ['Bagerhat Town', 'Sadar', 'Mongla'],
    'Chitalmari': ['Chitalmari Bazar', 'Bagerhat', 'Mollahat'],
    'Fakirhat': ['Fakirhat Bazar', 'Bagerhat', 'Kachua'],
    'Kachua': ['Kachua Bazar', 'Bagerhat', 'Fakirhat'],
    'Mollahat': ['Mollahat Bazar', 'Bagerhat', 'Chitalmari'],
    'Mongla': ['Mongla Bazar', 'Bagerhat', 'Sadar'],
    'Morrelganj': ['Morrelganj Bazar', 'Bagerhat', 'Rampal'],
    'Rampal': ['Rampal Bazar', 'Bagerhat', 'Morrelganj'],
    'Sarankhola': ['Sarankhola Bazar', 'Bagerhat', 'Mongla'],
    'Morelganj': ['Morelganj Bazar', 'Bagerhat', 'Rampal'],

    // Chuadanga District
    'Chuadanga Sadar': ['Chuadanga Town', 'Sadar', 'Alamdanga'],
    'Alamdanga': ['Alamdanga Bazar', 'Chuadanga', 'Damurhuda'],
    'Damurhuda': ['Damurhuda Bazar', 'Chuadanga', 'Jibannagar'],
    'Jibannagar': ['Jibannagar Bazar', 'Chuadanga', 'Damurhuda'],

    // Jessore District
    'Jessore Sadar': ['Jessore Town', 'Sadar', 'Jhikargachha'],
    'Abhaynagar': ['Abhaynagar Bazar', 'Jessore', 'Bagherpara'],
    'Bagherpara': ['Bagherpara Bazar', 'Jessore', 'Chaugachha'],
    'Chaugachha': ['Chaugachha Bazar', 'Jessore', 'Jhikargachha'],
    'Jhikargachha': ['Jhikargachha Bazar', 'Jessore', 'Sharsha'],
    'Keshabpur': ['Keshabpur Bazar', 'Jessore', 'Manirampur'],
    'Manirampur': ['Manirampur Bazar', 'Jessore', 'Sadar'],
    'Sharsha': ['Sharsha Bazar', 'Jessore', 'Jhikargachha'],

    // Jhenaidah District
    'Jhenaidah Sadar': ['Jhenaidah Town', 'Sadar', 'Shailkupa'],
    'Harinakunda': ['Harinakunda Bazar', 'Jhenaidah', 'Kaliganj'],
    'Kaliganj': ['Kaliganj Bazar', 'Jhenaidah', 'Harinakunda'],
    'Kotchandpur': ['Kotchandpur Bazar', 'Jhenaidah', 'Kaliganj'],
    'Maheshpur': ['Maheshpur Bazar', 'Jhenaidah', 'Sailkupa'],
    'Shailkupa': ['Shailkupa Bazar', 'Jhenaidah', 'Maheshpur'],

    // Kushtia District
    'Kushtia Sadar': ['Kushtia Town', 'Sadar', 'Mirpur'],
    'Bheramara': ['Bheramara Bazar', 'Kushtia', 'Daulatpur'],
    'Daulatpur': ['Daulatpur Bazar', 'Kushtia', 'Bheramara'],
    'Khoksa': ['Khoksa Bazar', 'Kushtia', 'Kumarkhali'],
    'Kumarkhali': ['Kumarkhali Bazar', 'Kushtia', 'Khoksa'],
    'Mirpur': ['Mirpur Bazar', 'Kushtia', 'Daulatpur'],

    // Magura District
    'Magura Sadar': ['Magura Town', 'Sadar', 'Mohammadpur'],
    'Mohammadpur': ['Mohammadpur Bazar', 'Magura', 'Shalikha'],
    'Shalikha': ['Shalikha Bazar', 'Magura', 'Sreepur'],
    'Sreepur': ['Sreepur Bazar', 'Magura', 'Shalikha'],

    // Meherpur District
    'Meherpur Sadar': ['Meherpur Town', 'Sadar', 'Gangni'],
    'Gangni': ['Gangni Bazar', 'Meherpur', 'Mujibnagar'],
    'Mujibnagar': ['Mujibnagar Bazar', 'Meherpur', 'Gangni'],

    // Narail District
    'Narail Sadar': ['Narail Town', 'Sadar', 'Kalia'],
    'Kalia': ['Kalia Bazar', 'Narail', 'Lohagara'],
    'Lohagara': ['Lohagara Bazar', 'Narail', 'Kalia'],

    // Satkhira District
    'Satkhira Sadar': ['Satkhira Town', 'Sadar', 'Tala'],
    'Assasuni': ['Assasuni Bazar', 'Satkhira', 'Debhata'],
    'Debhata': ['Debhata Bazar', 'Satkhira', 'Assasuni'],
    'Kalaroa': ['Kalaroa Bazar', 'Satkhira', 'Kaliganj'],
    'Kaliganj': ['Kaliganj Bazar', 'Satkhira', 'Kalaroa'],
    'Shyamnagar': ['Shyamnagar Bazar', 'Satkhira', 'Kaliganj'],
    'Tala': ['Tala Bazar', 'Satkhira', 'Sadar'],

    // ==================== BARISHAL DIVISION ====================
    // Barishal District
    'Barishal Sadar': ['Barishal Town', 'Sadar', 'Babuganj'],
    'Babuganj': ['Babuganj Bazar', 'Barishal', 'Bakerganj'],
    'Bakerganj': ['Bakerganj Bazar', 'Barishal', 'Babuganj'],
    'Banaripara': ['Banaripara Bazar', 'Barishal', 'Gaurnadi'],
    'Gaurnadi': ['Gaurnadi Bazar', 'Barishal', 'Bakerganj'],
    'Hizla': ['Hizla Bazar', 'Barishal', 'Mehendiganj'],
    'Mehendiganj': ['Mehendiganj Bazar', 'Barishal', 'Hizla'],
    'Muladi': ['Muladi Bazar', 'Barishal', 'Hizla'],
    'Wazirpur': ['Wazirpur Bazar', 'Barishal', 'Jhalokati'],
    'Agailjhara': ['Agailjhara Bazar', 'Barishal', 'Gaurnadi'],

    // Barguna District
    'Barguna Sadar': ['Barguna Town', 'Sadar', 'Amtali'],
    'Amtali': ['Amtali Bazar', 'Barguna', 'Bamna'],
    'Bamna': ['Bamna Bazar', 'Barguna', 'Betagi'],
    'Betagi': ['Betagi Bazar', 'Barguna', 'Amtali'],
    'Patharghata': ['Patharghata Bazar', 'Barguna', 'Barguna Sadar'],
    'Taltali': ['Taltali Bazar', 'Barguna', 'Patharghata'],

    // Bhola District
    'Bhola Sadar': ['Bhola Town', 'Sadar', 'Burhanuddin'],
    'Burhanuddin': ['Burhanuddin Bazar', 'Bhola', 'Char Fasson'],
    'Char Fasson': ['Char Fasson Bazar', 'Bhola', 'Lalmohan'],
    'Daulatkhan': ['Daulatkhan Bazar', 'Bhola', 'Bhola Sadar'],
    'Lalmohan': ['Lalmohan Bazar', 'Bhola', 'Char Fasson'],
    'Manpura': ['Manpura Bazar', 'Bhola', 'Tazumuddin'],
    'Tazumuddin': ['Tazumuddin Bazar', 'Bhola', 'Manpura'],

    // Jhalokati District
    'Jhalokati Sadar': ['Jhalokati Town', 'Sadar', 'Kathalia'],
    'Kathalia': ['Kathalia Bazar', 'Jhalokati', 'Nalchity'],
    'Nalchity': ['Nalchity Bazar', 'Jhalokati', 'Rajapur'],
    'Rajapur': ['Rajapur Bazar', 'Jhalokati', 'Nalchity'],

    // Patuakhali District
    'Patuakhali Sadar': ['Patuakhali Town', 'Sadar', 'Bauphal'],
    'Bauphal': ['Bauphal Bazar', 'Patuakhali', 'Dashmina'],
    'Dashmina': ['Dashmina Bazar', 'Patuakhali', 'Dumki'],
    'Dumki': ['Dumki Bazar', 'Patuakhali', 'Galachipa'],
    'Galachipa': ['Galachipa Bazar', 'Patuakhali', 'Kalapara'],
    'Kalapara': ['Kalapara Bazar', 'Patuakhali', 'Rangabali'],
    'Mirzaganj': ['Mirzaganj Bazar', 'Patuakhali', 'Bauphal'],
    'Rangabali': ['Rangabali Bazar', 'Patuakhali', 'Kalapara'],
    'Patuakhali': ['Patuakhali Town', 'Sadar', 'Rangabali'],

    // Pirojpur District
    'Pirojpur Sadar': ['Pirojpur Town', 'Sadar', 'Bhandaria'],
    'Bhandaria': ['Bhandaria Bazar', 'Pirojpur', 'Kawkhali'],
    'Kawkhali': ['Kawkhali Bazar', 'Pirojpur', 'Mathbaria'],
    'Mathbaria': ['Mathbaria Bazar', 'Pirojpur', 'Nazirpur'],
    'Nesarabad': ['Nesarabad Bazar', 'Pirojpur', 'Sadar'],
    'Nazirpur': ['Nazirpur Bazar', 'Pirojpur', 'Mathbaria'],
    'Zianagar': ['Zianagar Bazar', 'Pirojpur', 'Nesarabad'],

    // ==================== RANGPUR DIVISION ====================
    // Rangpur District
    'Rangpur Sadar': ['Rangpur Town', 'Sadar', 'Pirganj'],
    'Badarganj': ['Badarganj Bazar', 'Rangpur', 'Pirganj'],
    'Pirganj': ['Pirganj Bazar', 'Rangpur', 'Badarganj'],
    'Pirgachha': ['Pirgachha Bazar', 'Rangpur', 'Gobindaganj'],
    'Taraganj': ['Taraganj Bazar', 'Rangpur', 'Pirganj'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Rangpur', 'Pirgachha'],
    'Mithapukur': ['Mithapukur Bazar', 'Rangpur', 'Pirganj'],
    'Pirganj': ['Pirganj Bazar', 'Rangpur', 'Badarganj'],

    // Dinajpur District
    'Dinajpur Sadar': ['Dinajpur Town', 'Sadar', 'Chirirbandar'],
    'Chirirbandar': ['Chirirbandar Bazar', 'Dinajpur', 'Khansama'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Dinajpur', 'Sadar'],
    'Hakimpur': ['Hakimpur Bazar', 'Dinajpur', 'Kaharole'],
    'Kaharole': ['Kaharole Bazar', 'Dinajpur', 'Khansama'],
    'Khansama': ['Khansama Bazar', 'Dinajpur', 'Chirirbandar'],
    'Saidpur': ['Saidpur Town', 'Dinajpur', 'Parbatipur'],
    'Parbatipur': ['Parbatipur Bazar', 'Dinajpur', 'Saidpur'],
    'Phulbari': ['Phulbari Bazar', 'Dinajpur', 'Chirirbandar'],
    'Bochaganj': ['Bochaganj Bazar', 'Dinajpur', 'Sadar'],

    // Gaibandha District
    'Gaibandha Sadar': ['Gaibandha Town', 'Sadar', 'Gobindaganj'],
    'Fulchhari': ['Fulchhari Bazar', 'Gaibandha', 'Sundarganj'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Gaibandha', 'Sadar'],
    'Sundarganj': ['Sundarganj Bazar', 'Gaibandha', 'Fulchhari'],
    'Saghata': ['Saghata Bazar', 'Gaibandha', 'Gobindaganj'],

    // Kurigram District
    'Kurigram Sadar': ['Kurigram Town', 'Sadar', 'Ulipur'],
    'Bhurungamari': ['Bhurungamari Bazar', 'Kurigram', 'Fulbari'],
    'Char Rajibpur': ['Char Rajibpur Bazar', 'Kurigram', 'Ulipur'],
    'Chilmari': ['Chilmari Bazar', 'Kurigram', 'Rajibpur'],
    'Fulbari': ['Fulbari Bazar', 'Kurigram', 'Bhurungamari'],
    'Nageshwari': ['Nageshwari Bazar', 'Kurigram', 'Bhurungamari'],
    'Rajibpur': ['Rajibpur Bazar', 'Kurigram', 'Ulipur'],
    'Roumari': ['Roumari Bazar', 'Kurigram', 'Rajibpur'],
    'Ulipur': ['Ulipur Bazar', 'Kurigram', 'Chilmari'],

    // Lalmonirhat District
    'Lalmonirhat Sadar': ['Lalmonirhat Town', 'Sadar', 'Aditmari'],
    'Aditmari': ['Aditmari Bazar', 'Lalmonirhat', 'Kaliganj'],
    'Hatibandha': ['Hatibandha Bazar', 'Lalmonirhat', 'Patgram'],
    'Kaliganj': ['Kaliganj Bazar', 'Lalmonirhat', 'Aditmari'],
    'Patgram': ['Patgram Bazar', 'Lalmonirhat', 'Hatibandha'],
    'Burimari': ['Burimari Bazar', 'Lalmonirhat', 'Patgram'],

    // Nilphamari District
    'Nilphamari Sadar': ['Nilphamari Town', 'Sadar', 'Domar'],
    'Dimla': ['Dimla Bazar', 'Nilphamari', 'Jaldhaka'],
    'Domar': ['Domar Bazar', 'Nilphamari', 'Sadar'],
    'Jaldhaka': ['Jaldhaka Bazar', 'Nilphamari', 'Dimla'],
    'Kishoreganj': ['Kishoreganj Bazar', 'Nilphamari', 'Sadar'],
    'Saidpur': ['Saidpur Town', 'Nilphamari', 'Domar'],

    // Panchagarh District
    'Panchagarh Sadar': ['Panchagarh Town', 'Sadar', 'Boda'],
    'Atwari': ['Atwari Bazar', 'Panchagarh', 'Tetulia'],
    'Boda': ['Boda Bazar', 'Panchagarh', 'Sadar'],
    'Debiganj': ['Debiganj Bazar', 'Panchagarh', 'Boda'],
    'Tetulia': ['Tetulia Bazar', 'Panchagarh', 'Atwari'],

    // Thakurgaon District
    'Thakurgaon Sadar': ['Thakurgaon Town', 'Sadar', 'Pirganj'],
    'Baliadangi': ['Baliadangi Bazar', 'Thakurgaon', 'Haripur'],
    'Haripur': ['Haripur Bazar', 'Thakurgaon', 'Pirganj'],
    'Pirganj': ['Pirganj Bazar', 'Thakurgaon', 'Sadar'],
    'Ranisankail': ['Ranisankail Bazar', 'Thakurgaon', 'Baliadangi'],

    // ==================== MYMENSINGH DIVISION ====================
    // Mymensingh District
    'Mymensingh Sadar': ['Mymensingh Town', 'Sadar', 'Bhaluka'],
    'Bhaluka': ['Bhaluka Bazar', 'Mymensingh', 'Dhobaura'],
    'Dhobaura': ['Dhobaura Bazar', 'Mymensingh', 'Fulbaria'],
    'Fulbaria': ['Fulbaria Bazar', 'Mymensingh', 'Trishal'],
    'Gaffargaon': ['Gaffargaon Bazar', 'Mymensingh', 'Ishwarganj'],
    'Gauripur': ['Gauripur Bazar', 'Mymensingh', 'Haluaghat'],
    'Haluaghat': ['Haluaghat Bazar', 'Mymensingh', 'Gauripur'],
    'Ishwarganj': ['Ishwarganj Bazar', 'Mymensingh', 'Gaffargaon'],
    'Muktagachha': ['Muktagachha Bazar', 'Mymensingh', 'Nandail'],
    'Nandail': ['Nandail Bazar', 'Mymensingh', 'Muktagachha'],
    'Phulpur': ['Phulpur Bazar', 'Mymensingh', 'Trishal'],
    'Trishal': ['Trishal Bazar', 'Mymensingh', 'Bhaluka'],
    'Tarakanda': ['Tarakanda Bazar', 'Mymensingh', 'Phulpur'],

    // Jamalpur District
    'Jamalpur Sadar': ['Jamalpur Town', 'Sadar', 'Baksiganj'],
    'Baksiganj': ['Baksiganj Bazar', 'Jamalpur', 'Dewangganj'],
    'Dewangganj': ['Dewangganj Bazar', 'Jamalpur', 'Islampur'],
    'Islampur': ['Islampur Bazar', 'Jamalpur', 'Madarganj'],
    'Madarganj': ['Madarganj Bazar', 'Jamalpur', 'Sarishabari'],
    'Melandaha': ['Melandaha Bazar', 'Jamalpur', 'Sarishabari'],
    'Sarishabari': ['Sarishabari Bazar', 'Jamalpur', 'Melandaha'],
    'Sharishabari': ['Sharishabari Bazar', 'Jamalpur', 'Madarganj'],

    // Netrokona District
    'Netrokona Sadar': ['Netrokona Town', 'Sadar', 'Atpara'],
    'Atpara': ['Atpara Bazar', 'Netrokona', 'Barhatta'],
    'Barhatta': ['Barhatta Bazar', 'Netrokona', 'Durgapur'],
    'Durgapur': ['Durgapur Bazar', 'Netrokona', 'Kalmakanda'],
    'Kalmakanda': ['Kalmakanda Bazar', 'Netrokona', 'Durgapur'],
    'Kendua': ['Kendua Bazar', 'Netrokona', 'Atpara'],
    'Khaliajuri': ['Khaliajuri Bazar', 'Netrokona', 'Madan'],
    'Madan': ['Madan Bazar', 'Netrokona', 'Khaliajuri'],
    'Mohanganj': ['Mohanganj Bazar', 'Netrokona', 'Haluaghat'],
    'Purbadhala': ['Purbadhala Bazar', 'Netrokona', 'Kendua'],
    'Khaliajuri': ['Khaliajuri Bazar', 'Netrokona', 'Mohanganj'],

    // Sherpur District
    'Sherpur Sadar': ['Sherpur Town', 'Sadar', 'Jhenaigati'],
    'Jhenaigati': ['Jhenaigati Bazar', 'Sherpur', 'Nakla'],
    'Nakla': ['Nakla Bazar', 'Sherpur', 'Nalitabari'],
    'Nalitabari': ['Nalitabari Bazar', 'Sherpur', 'Sreebardi'],
    'Sreebardi': ['Sreebardi Bazar', 'Sherpur', 'Nalitabari'],

    // ==================== ADDITIONAL MISSING UPAZILAS ====================
    // Barishal District - Missing
    'Bakerganj': ['Bakerganj Bazar', 'Barishal', 'Babuganj'],
    'Gaurnadi': ['Gaurnadi Bazar', 'Barishal', 'Banaripara'],
    'Hizla': ['Hizla Bazar', 'Barishal', 'Mehendiganj'],
    'Mehendiganj': ['Mehendiganj Bazar', 'Barishal', 'Hizla'],
    'Muladi': ['Muladi Bazar', 'Barishal', 'Hizla'],
    'Wazirpur': ['Wazirpur Bazar', 'Barishal', 'Jhalokati'],
    'Agailjhara': ['Agailjhara Bazar', 'Barishal', 'Gaurnadi'],
    'Babuganj': ['Babuganj Bazar', 'Barishal', 'Agailjhara'],

    // Barguna District - Missing
    'Barguna Sadar': ['Barguna Town', 'Sadar', 'Amtali'],
    'Amtali': ['Amtali Bazar', 'Barguna', 'Bamna'],
    'Bamna': ['Bamna Bazar', 'Barguna', 'Betagi'],
    'Betagi': ['Betagi Bazar', 'Barguna', 'Patharghata'],
    'Patharghata': ['Patharghata Bazar', 'Barguna', 'Taltali'],
    'Taltali': ['Taltali Bazar', 'Barguna', 'Patharghata'],

    // Bhola District - Missing
    'Bhola Sadar': ['Bhola Town', 'Sadar', 'Burhanuddin'],
    'Burhanuddin': ['Burhanuddin Bazar', 'Bhola', 'Char Fasson'],
    'Char Fasson': ['Char Fasson Bazar', 'Bhola', 'Lalmohan'],
    'Daulatkhan': ['Daulatkhan Bazar', 'Bhola', 'Sadar'],
    'Lalmohan': ['Lalmohan Bazar', 'Bhola', 'Char Fasson'],
    'Manpura': ['Manpura Bazar', 'Bhola', 'Tazumuddin'],
    'Tazumuddin': ['Tazumuddin Bazar', 'Bhola', 'Manpura'],

    // Chandpur District - Missing
    'Chandpur Sadar': ['Chandpur Town', 'Sadar', 'Shahrasti'],
    'Faridganj': ['Faridganj Bazar', 'Chandpur', 'Haimchar'],
    'Haimchar': ['Haimchar Bazar', 'Chandpur', 'Faridganj'],
    'Haziganj': ['Haziganj Bazar', 'Chandpur', 'Kachua'],
    'Kachua': ['Kachua Bazar', 'Chandpur', 'Haziganj'],
    'Matlab Dakshin': ['Matlab Dakshin Bazar', 'Chandpur', 'Matlab Uttar'],
    'Matlab Uttar': ['Matlab Uttar Bazar', 'Chandpur', 'Matlab Dakshin'],
    'Shahrasti': ['Shahrasti Bazar', 'Chandpur', 'Sadar'],

    // Comilla District - Missing
    'Comilla Sadar': ['Comilla Town', 'Sadar', 'Homna'],
    'Barura': ['Barura Bazar', 'Comilla', 'Chandina'],
    'Brahmanpara': ['Brahmanpara Bazar', 'Comilla', 'Burichang'],
    'Burichang': ['Burichang Bazar', 'Comilla', 'Brahmanpara'],
    'Chandina': ['Chandina Bazar', 'Comilla', 'Barura'],
    'Chauddagram': ['Chauddagram Bazar', 'Comilla', 'Daudkandi'],
    'Daudkandi': ['Daudkandi Bazar', 'Comilla', 'Chauddagram'],
    'Debidwar': ['Debidwar Bazar', 'Comilla', 'Muradnagar'],
    'Homna': ['Homna Bazar', 'Comilla', 'Meghna'],
    'Laksam': ['Laksam Bazar', 'Comilla', 'Nangalkot'],
    'Lalmai': ['Lalmai Bazar', 'Comilla', 'Sadar'],
    'Meghna': ['Meghna Bazar', 'Comilla', 'Homna'],
    'Monohorgonj': ['Monohorgonj Bazar', 'Comilla', 'Debidwar'],
    'Muradnagar': ['Muradnagar Bazar', 'Comilla', 'Debidwar'],
    'Nangalkot': ['Nangalkot Bazar', 'Comilla', 'Laksam'],
    'Titas': ['Titas Bazar', 'Comilla', 'Daudkandi'],

    // Feni District - Missing
    'Feni Sadar': ['Feni Town', 'Sadar', 'Daganbhuiyan'],
    'Chhagalnaiya': ['Chhagalnaiya Bazar', 'Feni', 'Fulgazi'],
    'Daganbhuiyan': ['Daganbhuiyan Bazar', 'Feni', 'Sonagazi'],
    'Fulgazi': ['Fulgazi Bazar', 'Feni', 'Parshuram'],
    'Parshuram': ['Parshuram Bazar', 'Feni', 'Fulgazi'],
    'Sonagazi': ['Sonagazi Bazar', 'Feni', 'Daganbhuiyan'],

    // Khagrachhari District - Missing
    'Khagrachhari Sadar': ['Khagrachhari Town', 'Sadar', 'Dighinala'],
    'Dighinala': ['Dighinala Bazar', 'Khagrachhari', 'Panchari'],
    'Guimara': ['Guimara Bazar', 'Khagrachhari', 'Ramgarh'],
    'Lakshmichhari': ['Lakshmichhari Bazar', 'Khagrachhari', 'Mahalchhari'],
    'Mahalchhari': ['Mahalchhari Bazar', 'Khagrachhari', 'Lakshmichhari'],
    'Manikchhari': ['Manikchhari Bazar', 'Khagrachhari', 'Matiranga'],
    'Matiranga': ['Matiranga Bazar', 'Khagrachhari', 'Manikchhari'],
    'Panchhari': ['Panchhari Bazar', 'Khagrachhari', 'Dighinala'],
    'Ramgarh': ['Ramgarh Bazar', 'Khagrachhari', 'Guimara'],

    // Lakshmipur District - Missing
    'Lakshmipur Sadar': ['Lakshmipur Town', 'Sadar', 'Ramgati'],
    'Kamalnagar': ['Kamalnagar Bazar', 'Lakshmipur', 'Raipur'],
    'Raipur': ['Raipur Bazar', 'Lakshmipur', 'Kamalnagar'],
    'Ramganj': ['Ramganj Bazar', 'Lakshmipur', 'Ramgati'],
    'Ramgati': ['Ramgati Bazar', 'Lakshmipur', 'Ramganj'],

    // Noakhali District - Missing
    'Noakhali Sadar': ['Noakhali Town', 'Sadar', 'Maijdee'],
    'Begumganj': ['Begumganj Bazar', 'Noakhali', 'Chatkhil'],
    'Chatkhil': ['Chatkhil Bazar', 'Noakhali', 'Senbagh'],
    'Companiganj': ['Companiganj Bazar', 'Noakhali', 'Hatiya'],
    'Hatiya': ['Hatiya Bazar', 'Noakhali', 'Oskhali'],
    'Kabirhat': ['Kabirhat Bazar', 'Noakhali', 'Senbagh'],
    'Senbagh': ['Senbagh Bazar', 'Noakhali', 'Kabirhat'],
    'Sonaimuri': ['Sonaimuri Bazar', 'Noakhali', 'Chatkhil'],
    'Subarnachar': ['Subarnachar Bazar', 'Noakhali', 'Hatiya'],

    // Rangamati District - Missing
    'Rangamati Sadar': ['Rangamati Town', 'Sadar', 'Kaptai'],
    'Bagaichhari': ['Bagaichhari Bazar', 'Rangamati', 'Barkal'],
    'Barkal': ['Barkal Bazar', 'Rangamati', 'Belaichhari'],
    'Belaichhari': ['Belaichhari Bazar', 'Rangamati', 'Barkal'],
    'Juraichhari': ['Juraichhari Bazar', 'Rangamati', 'Naniarchar'],
    'Kaptai': ['Kaptai Bazar', 'Rangamati', 'Chandraghona'],
    'Kawkhali': ['Kawkhali Bazar', 'Rangamati', 'Rangamati Sadar'],
    'Langadu': ['Langadu Bazar', 'Rangamati', 'Naniarchar'],
    'Naniarchar': ['Naniarchar Bazar', 'Rangamati', 'Langadu'],
    'Rajasthali': ['Rajasthali Bazar', 'Rangamati', 'Kaptai'],

    // Bandarban District - Missing
    'Bandarban Sadar': ['Bandarban Town', 'Sadar', 'Ruma'],
    'Alikadam': ['Alikadam Bazar', 'Bandarban', 'Thanchi'],
    'Lama': ['Lama Bazar', 'Bandarban', 'Alikadam'],
    'Naikhongchhari': ['Naikhongchhari Bazar', 'Bandarban', 'Lama'],
    'Rowangchhari': ['Rowangchhari Bazar', 'Bandarban', 'Ruma'],
    'Ruma': ['Ruma Bazar', 'Bandarban', 'Rowangchhari'],
    'Thanchi': ['Thanchi Bazar', 'Bandarban', 'Ruma'],

    // Brahmanbaria District - Missing
    'Brahmanbaria Sadar': ['Brahmanbaria Town', 'Sadar', 'Akhaura'],
    'Akhaura': ['Akhaura Bazar', 'Brahmanbaria', 'Ashuganj'],
    'Ashuganj': ['Ashuganj Bazar', 'Brahmanbaria', 'Akhaura'],
    'Bancharampur': ['Bancharampur Bazar', 'Brahmanbaria', 'Bijoynagar'],
    'Bijoynagar': ['Bijoynagar Bazar', 'Brahmanbaria', 'Bancharampur'],
    'Kasba': ['Kasba Bazar', 'Brahmanbaria', 'Nabinagar'],
    'Nabinagar': ['Nabinagar Bazar', 'Brahmanbaria', 'Kasba'],
    'Nasirnagar': ['Nasirnagar Bazar', 'Brahmanbaria', 'Sadar'],
    'Sarail': ['Sarail Bazar', 'Brahmanbaria', 'Ashuganj'],

    // Dhaka District - Missing
    'Dhamrai': ['Dhamrai Bazar', 'Dhaka', 'Savar'],
    'Dohar': ['Dohar Bazar', 'Dhaka', 'Keraniganj'],
    'Keraniganj': ['Keraniganj Bazar', 'Dhaka', 'Dohar'],
    'Nawabganj': ['Nawabganj Bazar', 'Dhaka', 'Savar'],
    'Savar': ['Savar Bazar', 'Dhaka', 'Dhamrai'],
    'Baridhara': ['Baridhara DOHS', 'Diplomatic Zone', 'Gulshan'],
    'Paltan': ['Paltan Maidan', 'Topkhana Road', 'Bijoynagar'],
    'Puran Dhaka': ['Puran Dhaka', 'Lalbagh', 'Chawkbazar'],
    'Lalmatia': ['Lalmatia', 'Dhanmondi', 'Satmasjid Road'],
    'Shyamoli': ['Shyamoli', 'Khamar Bari', 'Asad Gate'],
    'Farmgate': ['Farmgate', 'Tejgaon', 'Bijoy Sarani'],
    'Elephant Road': ['Elephant Road', 'Ramna', 'Farmgate'],
    'Khilgaon': ['Khilgaon', 'Bashabo', 'Malibagh'],
    'Rampura': ['Rampura', 'Badda', 'Manda'],
    'Bashabo': ['Bashabo', 'Khilgaon', 'Manda'],
    'Panchlaish': ['Panchlaish', 'Khulshi', 'Chattogram'],

    // Faridpur District - Missing
    'Faridpur Sadar': ['Faridpur Town', 'Sadar', 'Alfadanga'],
    'Alfadanga': ['Alfadanga Bazar', 'Faridpur', 'Nagarkanda'],
    'Bhanga': ['Bhanga Bazar', 'Faridpur', 'Sadarpur'],
    'Boalmari': ['Boalmari Bazar', 'Faridpur', 'Madhukhali'],
    'Charbhadrasan': ['Charbhadrasan Bazar', 'Faridpur', 'Boalmari'],
    'Madhukhali': ['Madhukhali Bazar', 'Faridpur', 'Boalmari'],
    'Nagarkanda': ['Nagarkanda Bazar', 'Faridpur', 'Bhanga'],
    'Sadarpur': ['Sadarpur Bazar', 'Faridpur', 'Bhanga'],
    'Saltha': ['Saltha Bazar', 'Faridpur', 'Nagarkanda'],

    // Gazipur District - Missing
    'Gazipur Sadar': ['Gazipur Town', 'Sadar', 'Kaliakair'],
    'Kaliakair': ['Kaliakair Bazar', 'Gazipur', 'Chandra'],
    'Kaliganj': ['Kaliganj Bazar', 'Gazipur', 'Kapasia'],
    'Kapasia': ['Kapasia Bazar', 'Gazipur', 'Kaliganj'],
    'Sreepur': ['Sreepur Bazar', 'Gazipur', 'Kapasia'],
    'Board Bazar': ['Board Bazar', 'Joydebpur', 'Gazipur'],
    'Chowrasta': ['Chowrasta', 'Joydebpur', 'Gazipur'],

    // Gopalganj District - Missing
    'Gopalganj Sadar': ['Gopalganj Town', 'Sadar', 'Kashiani'],
    'Kashiani': ['Kashiani Bazar', 'Gopalganj', 'Muksudpur'],
    'Kotalipara': ['Kotalipara Bazar', 'Gopalganj', 'Tungipara'],
    'Muksudpur': ['Muksudpur Bazar', 'Gopalganj', 'Kashiani'],
    'Tungipara': ['Tungipara Bazar', 'Gopalganj', 'Kotalipara'],

    // Kishoreganj District - Missing
    'Kishoreganj Sadar': ['Kishoreganj Town', 'Sadar', 'Austagram'],
    'Austagram': ['Austagram Bazar', 'Kishoreganj', 'Mithamain'],
    'Bajitpur': ['Bajitpur Bazar', 'Kishoreganj', 'Bhairab'],
    'Bhairab': ['Bhairab Bazar', 'Kishoreganj', 'Kuliarchar'],
    'Hossainpur': ['Hossainpur Bazar', 'Kishoreganj', 'Pakundia'],
    'Itna': ['Itna Bazar', 'Kishoreganj', 'Mithamain'],
    'Karimganj': ['Karimganj Bazar', 'Kishoreganj', 'Kuliarchar'],
    'Katiadi': ['Katiadi Bazar', 'Kishoreganj', 'Bhairab'],
    'Kuliarchar': ['Kuliarchar Bazar', 'Kishoreganj', 'Bhairab'],
    'Mithamain': ['Mithamain Bazar', 'Kishoreganj', 'Austagram'],
    'Nikli': ['Nikli Bazar', 'Kishoreganj', 'Itna'],
    'Pakundia': ['Pakundia Bazar', 'Kishoreganj', 'Hossainpur'],
    'Tarail': ['Tarail Bazar', 'Kishoreganj', 'Pakundia'],

    // Madaripur District - Missing
    'Madaripur Sadar': ['Madaripur Town', 'Sadar', 'Kalkini'],
    'Kalkini': ['Kalkini Bazar', 'Madaripur', 'Rajoir'],
    'Rajoir': ['Rajoir Bazar', 'Madaripur', 'Shibchar'],
    'Shibchar': ['Shibchar Bazar', 'Madaripur', 'Kalkini'],
    'Dasar': ['Dasar Bazar', 'Madaripur', 'Rajoir'],

    // Manikganj District - Missing
    'Manikganj Sadar': ['Manikganj Town', 'Sadar', 'Daulatpur'],
    'Daulatpur': ['Daulatpur Bazar', 'Manikganj', 'Ghior'],
    'Ghior': ['Ghior Bazar', 'Manikganj', 'Harirampur'],
    'Harirampur': ['Harirampur Bazar', 'Manikganj', 'Saturia'],
    'Saturia': ['Saturia Bazar', 'Manikganj', 'Shivalaya'],
    'Shivalaya': ['Shivalaya Bazar', 'Manikganj', 'Saturia'],
    'Singair': ['Singair Bazar', 'Manikganj', 'Dhamrai'],

    // Munshiganj District - Missing
    'Munshiganj Sadar': ['Munshiganj Town', 'Sadar', 'Srinagar'],
    'Gazaria': ['Gazaria Bazar', 'Munshiganj', 'Sonargaon'],
    'Lohajang': ['Lohajang Bazar', 'Munshiganj', 'Sirajdikhan'],
    'Sirajdikhan': ['Sirajdikhan Bazar', 'Munshiganj', 'Lohajang'],
    'Sreenagar': ['Sreenagar Bazar', 'Munshiganj', 'Sirajdikhan'],
    'Tongibari': ['Tongibari Bazar', 'Munshiganj', 'Lohajang'],

    // Narayanganj District - Missing
    'Narayanganj Sadar': ['Narayanganj Town', 'Sadar', 'Bandar'],
    'Araihazar': ['Araihazar Bazar', 'Narayanganj', 'Sonargaon'],
    'Bandar': ['Bandar Bazar', 'Narayanganj', 'Sadar'],
    'Rupganj': ['Rupganj Bazar', 'Narayanganj', 'Gazaria'],
    'Sonargaon': ['Sonargaon Bazar', 'Narayanganj', 'Bandar'],
    'Fatullah': ['Fatullah Bazar', 'Narayanganj', 'Siddhirganj'],
    'Siddhirganj': ['Siddhirganj Bazar', 'Narayanganj', 'Fatullah'],

    // Narsingdi District - Missing
    'Narsingdi Sadar': ['Narsingdi Town', 'Sadar', 'Belabo'],
    'Belabo': ['Belabo Bazar', 'Narsingdi', 'Moktarpur'],
    'Monohardi': ['Monohardi Bazar', 'Narsingdi', 'Belabo'],
    'Palash': ['Palash Bazar', 'Narsingdi', 'Raipura'],
    'Raipura': ['Raipura Bazar', 'Narsingdi', 'Palash'],
    'Shibpur': ['Shibpur Bazar', 'Narsingdi', 'Sadar'],

    // Rajbari District - Missing
    'Rajbari Sadar': ['Rajbari Town', 'Sadar', 'Baliakandi'],
    'Baliakandi': ['Baliakandi Bazar', 'Rajbari', 'Goalanda'],
    'Goalanda': ['Goalanda Bazar', 'Rajbari', 'Pangsha'],
    'Kalukhali': ['Kalukhali Bazar', 'Rajbari', 'Baliakandi'],
    'Pangsha': ['Pangsha Bazar', 'Rajbari', 'Goalanda'],

    // Shariatpur District - Missing
    'Shariatpur Sadar': ['Shariatpur Town', 'Sadar', 'Bhedarganj'],
    'Bhedarganj': ['Bhedarganj Bazar', 'Shariatpur', 'Gosairhat'],
    'Damudya': ['Damudya Bazar', 'Shariatpur', 'Naria'],
    'Gosairhat': ['Gosairhat Bazar', 'Shariatpur', 'Bhedarganj'],
    'Naria': ['Naria Bazar', 'Shariatpur', 'Damudya'],
    'Zajira': ['Zajira Bazar', 'Shariatpur', 'Naria'],

    // Tangail District - Missing
    'Tangail Sadar': ['Tangail Town', 'Sadar', 'Basail'],
    'Basail': ['Basail Bazar', 'Tangail', 'Bhuapur'],
    'Bhuapur': ['Bhuapur Bazar', 'Tangail', 'Delduar'],
    'Delduar': ['Delduar Bazar', 'Tangail', 'Nagarpur'],
    'Dhanbari': ['Dhanbari Bazar', 'Tangail', 'Madhupur'],
    'Ghatail': ['Ghatail Bazar', 'Tangail', 'Madhupur'],
    'Gopalpur': ['Gopalpur Bazar', 'Tangail', 'Madhupur'],
    'Kalihati': ['Kalihati Bazar', 'Tangail', 'Basail'],
    'Madhupur': ['Madhupur Bazar', 'Tangail', 'Ghatail'],
    'Mirzapur': ['Mirzapur Bazar', 'Tangail', 'Kalihati'],
    'Nagarpur': ['Nagarpur Bazar', 'Tangail', 'Delduar'],
    'Sakhipur': ['Sakhipur Bazar', 'Tangail', 'Basail'],

    // Khulna District - Missing
    'Khulna Sadar': ['Khulna Town', 'Sadar', 'Sonadanga'],
    'Batiaghata': ['Batiaghata Bazar', 'Khulna', 'Dacope'],
    'Dacope': ['Dacope Bazar', 'Khulna', 'Koyra'],
    'Dighalia': ['Dighalia Bazar', 'Khulna', 'Batiaghata'],
    'Dumuria': ['Dumuria Bazar', 'Khulna', 'Phultala'],
    'Koyra': ['Koyra Bazar', 'Khulna', 'Paikgachha'],
    'Paikgachha': ['Paikgachha Bazar', 'Khulna', 'Koyra'],
    'Phultala': ['Phultala Bazar', 'Khulna', 'Terokhada'],
    'Rupsa': ['Rupsa Bazar', 'Khulna', 'Terokhada'],
    'Terokhada': ['Terokhada Bazar', 'Khulna', 'Rupsa'],
    'Sonadanga': ['Sonadanga Bazar', 'Khulna', 'Khalishpur'],
    'Khalishpur': ['Khalishpur Bazar', 'Khulna', 'Daulatpur'],
    'Daulatpur': ['Daulatpur Bazar', 'Khulna', 'Shibbari'],
    'Shibbari': ['Shibbari Bazar', 'Khulna', 'Daulatpur'],

    // Bagerhat District - Missing
    'Bagerhat Sadar': ['Bagerhat Town', 'Sadar', 'Mongla'],
    'Chitalmari': ['Chitalmari Bazar', 'Bagerhat', 'Mollahat'],
    'Fakirhat': ['Fakirhat Bazar', 'Bagerhat', 'Kachua'],
    'Kachua': ['Kachua Bazar', 'Bagerhat', 'Fakirhat'],
    'Mollahat': ['Mollahat Bazar', 'Bagerhat', 'Chitalmari'],
    'Mongla': ['Mongla Bazar', 'Bagerhat', 'Sadar'],
    'Morrelganj': ['Morrelganj Bazar', 'Bagerhat', 'Rampal'],
    'Rampal': ['Rampal Bazar', 'Bagerhat', 'Morrelganj'],
    'Sarankhola': ['Sarankhola Bazar', 'Bagerhat', 'Mongla'],
    'Morelganj': ['Morelganj Bazar', 'Bagerhat', 'Rampal'],

    // Chuadanga District - Missing
    'Chuadanga Sadar': ['Chuadanga Town', 'Sadar', 'Alamdanga'],
    'Alamdanga': ['Alamdanga Bazar', 'Chuadanga', 'Damurhuda'],
    'Damurhuda': ['Damurhuda Bazar', 'Chuadanga', 'Jibannagar'],
    'Jibannagar': ['Jibannagar Bazar', 'Chuadanga', 'Damurhuda'],

    // Jessore District - Missing
    'Jessore Sadar': ['Jessore Town', 'Sadar', 'Jhikargachha'],
    'Abhaynagar': ['Abhaynagar Bazar', 'Jessore', 'Bagherpara'],
    'Bagherpara': ['Bagherpara Bazar', 'Jessore', 'Chaugachha'],
    'Chaugachha': ['Chaugachha Bazar', 'Jessore', 'Jhikargachha'],
    'Jhikargachha': ['Jhikargachha Bazar', 'Jessore', 'Sharsha'],
    'Keshabpur': ['Keshabpur Bazar', 'Jessore', 'Manirampur'],
    'Manirampur': ['Manirampur Bazar', 'Jessore', 'Sadar'],
    'Sharsha': ['Sharsha Bazar', 'Jessore', 'Jhikargachha'],

    // Jhenaidah District - Missing
    'Jhenaidah Sadar': ['Jhenaidah Town', 'Sadar', 'Shailkupa'],
    'Harinakunda': ['Harinakunda Bazar', 'Jhenaidah', 'Kaliganj'],
    'Kaliganj': ['Kaliganj Bazar', 'Jhenaidah', 'Harinakunda'],
    'Kotchandpur': ['Kotchandpur Bazar', 'Jhenaidah', 'Kaliganj'],
    'Maheshpur': ['Maheshpur Bazar', 'Jhenaidah', 'Shailkupa'],
    'Shailkupa': ['Shailkupa Bazar', 'Jhenaidah', 'Maheshpur'],

    // Kushtia District - Missing
    'Kushtia Sadar': ['Kushtia Town', 'Sadar', 'Mirpur'],
    'Bheramara': ['Bheramara Bazar', 'Kushtia', 'Daulatpur'],
    'Daulatpur': ['Daulatpur Bazar', 'Kushtia', 'Bheramara'],
    'Khoksa': ['Khoksa Bazar', 'Kushtia', 'Kumarkhali'],
    'Kumarkhali': ['Kumarkhali Bazar', 'Kushtia', 'Khoksa'],
    'Mirpur': ['Mirpur Bazar', 'Kushtia', 'Daulatpur'],

    // Magura District - Missing
    'Magura Sadar': ['Magura Town', 'Sadar', 'Mohammadpur'],
    'Mohammadpur': ['Mohammadpur Bazar', 'Magura', 'Shalikha'],
    'Shalikha': ['Shalikha Bazar', 'Magura', 'Sreepur'],
    'Sreepur': ['Sreepur Bazar', 'Magura', 'Shalikha'],

    // Meherpur District - Missing
    'Meherpur Sadar': ['Meherpur Town', 'Sadar', 'Gangni'],
    'Gangni': ['Gangni Bazar', 'Meherpur', 'Mujibnagar'],
    'Mujibnagar': ['Mujibnagar Bazar', 'Meherpur', 'Gangni'],

    // Narail District - Missing
    'Narail Sadar': ['Narail Town', 'Sadar', 'Kalia'],
    'Kalia': ['Kalia Bazar', 'Narail', 'Lohagara'],
    'Lohagara': ['Lohagara Bazar', 'Narail', 'Kalia'],

    // Satkhira District - Missing
    'Satkhira Sadar': ['Satkhira Town', 'Sadar', 'Tala'],
    'Assasuni': ['Assasuni Bazar', 'Satkhira', 'Debhata'],
    'Debhata': ['Debhata Bazar', 'Satkhira', 'Assasuni'],
    'Kalaroa': ['Kalaroa Bazar', 'Satkhira', 'Kaliganj'],
    'Kaliganj': ['Kaliganj Bazar', 'Satkhira', 'Kalaroa'],
    'Shyamnagar': ['Shyamnagar Bazar', 'Satkhira', 'Kaliganj'],
    'Tala': ['Tala Bazar', 'Satkhira', 'Sadar'],

    // Rangpur District - Missing
    'Gangachara': ['Gangachara Bazar', 'Rangpur', 'Mithapukur'],
    'Kaunia': ['Kaunia Bazar', 'Rangpur', 'Pirganj'],
    'Modern More': ['Modern More', 'Rangpur', 'Central Road'],
    'Central Road': ['Central Road', 'Rangpur', 'Jahaj Company'],
    'Jahaj Company More': ['Jahaj Company', 'Rangpur', 'Modern More'],

    // Dinajpur District - Missing
    'Birampur': ['Birampur Bazar', 'Dinajpur', 'Birganj'],
    'Birganj': ['Birganj Bazar', 'Dinajpur', 'Phulbari'],
    'Biral': ['Biral Bazar', 'Dinajpur', 'Bochaganj'],
    'Fulbari': ['Fulbari Bazar', 'Dinajpur', 'Birganj'],
    'Ghoraghat': ['Ghoraghat Bazar', 'Dinajpur', 'Khansama'],
    'Nawabganj': ['Nawabganj Bazar', 'Dinajpur', 'Bochaganj'],
    'Nawabganj': ['Nawabganj Bazar', 'Dinajpur', 'Saidpur'],

    // Gaibandha District - Missing
    'Palashbari': ['Palashbari Bazar', 'Gaibandha', 'Sundarganj'],
    'Sadullapur': ['Sadullapur Bazar', 'Gaibandha', 'Fulchhari'],
    'Saghatta': ['Saghatta Bazar', 'Gaibandha', 'Gobindaganj'],

    // Kurigram District - Missing
    'Rajarhat': ['Rajarhat Bazar', 'Kurigram', 'Ulipur'],
    'Raumari': ['Raumari Bazar', 'Kurigram', 'Char Rajibpur'],
    'Ulipur': ['Ulipur Bazar', 'Kurigram', 'Rajarhat'],
    'Phulbari': ['Phulbari Bazar', 'Kurigram', 'Bhurungamari'],

    // Lalmonirhat District - Missing
    'Kaliganj': ['Kaliganj Bazar', 'Lalmonirhat', 'Aditmari'],
    'Patgram': ['Patgram Bazar', 'Lalmonirhat', 'Burimari'],
    'Burimari': ['Burimari Bazar', 'Lalmonirhat', 'Patgram'],

    // Nilphamari District - Missing
    'Jaldhaka': ['Jaldhaka Bazar', 'Nilphamari', 'Domar'],
    'Kishoreganj': ['Kishoreganj Bazar', 'Nilphamari', 'Saidpur'],
    'Saidpur': ['Saidpur Town', 'Nilphamari', 'Domar'],

    // Panchagarh District - Missing
    'Atwari': ['Atwari Bazar', 'Panchagarh', 'Tetulia'],
    'Boda': ['Boda Bazar', 'Panchagarh', 'Sadar'],
    'Debiganj': ['Debiganj Bazar', 'Panchagarh', 'Boda'],
    'Tetulia': ['Tetulia Bazar', 'Panchagarh', 'Atwari'],

    // Thakurgaon District - Missing
    'Baliadangi': ['Baliadangi Bazar', 'Thakurgaon', 'Pirganj'],
    'Haripur': ['Haripur Bazar', 'Thakurgaon', 'Sadar'],
    'Ranisankail': ['Ranisankail Bazar', 'Thakurgaon', 'Baliadangi'],

    // Sylhet District - Missing
    'Balaganj': ['Balaganj Bazar', 'Sylhet', 'Bishwanath'],
    'Beanibazar': ['Beani Bazar', 'Sylhet', 'Balaganj'],
    'Bishwanath': ['Bishwanath Bazar', 'Sylhet', 'Balaganj'],
    'Companiganj': ['Companiganj Bazar', 'Sylhet', 'Dakshin Surma'],
    'Dakshin Surma': ['Dakshin Surma Bazar', 'Sylhet', 'Fenchuganj'],
    'Fenchuganj': ['Fenchuganj Bazar', 'Sylhet', 'Golapganj'],
    'Golapganj': ['Golapganj Bazar', 'Sylhet', 'Jaintiapur'],
    'Gowainghat': ['Gowainghat Bazar', 'Sylhet', 'Jaflong'],
    'Jaintiapur': ['Jaintiapur Bazar', 'Sylhet', 'Golapganj'],
    'Kanaighat': ['Kanaighat Bazar', 'Sylhet', 'Gowainghat'],
    'Osmani Nagar': ['Osmani Nagar', 'Sylhet', 'Balaganj'],
    'Zakiganj': ['Zakiganj Bazar', 'Sylhet', 'Beanibazar'],
    'Bandarbazar': ['Bandarbazar', 'Sylhet', 'Ambarkhana'],
    'Maulvibazar': ['Maulvibazar Bazar', 'Sylhet', 'Sreemangal'],

    // Habiganj District - Missing
    'Baniyachong': ['Baniyachong Bazar', 'Habiganj', 'Chunarughat'],
    'Chunarughat': ['Chunarughat Bazar', 'Habiganj', 'Lakhai'],
    'Lakhai': ['Lakhai Bazar', 'Habiganj', 'Chunarughat'],
    'Nabiganj': ['Nabiganj Bazar', 'Habiganj', 'Madhabpur'],

    // Moulvibazar District - Missing
    'Moulvibazar Sadar': [
        'Saifur Rahman Road',
        'Court Road',
        'Choumohona',
        'Borohat (Barhat)',
        'Kalighat',
        'College Road',
        'Stadium Road',
        'Central Road',
        'Sherpur Road',
        'Kusumbag',
        'Shah Mostafa Road',
        'Muslim Quarter',
        'West Bazar',
        'East Bazar',
        'Town Hall Area',
        'Post Office Road',
        'Press Club Area',
        'DC Office Area'
    ],
    'Barlekha': ['Barlekha Bazar'],
    'Juri': ['Juri Bazar'],
    'Kamalganj': ['Kamalganj Bazar'],
    'Kulaura': ['Kulaura Bazar'],
    'Rajnagar': ['Rajnagar Bazar'],

    // Sunamganj District - Missing
    'Bishwamvarpur': ['Bishwamvarpur Bazar', 'Sunamganj', 'Chhatak'],
    'Chhatak': ['Chhatak Bazar', 'Sunamganj', 'Dakshin Sunamganj'],
    'Dakshin Sunamganj': ['Dakshin Sunamganj Bazar', 'Sunamganj', 'Derai'],
    'Derai': ['Derai Bazar', 'Sunamganj', 'Dharmapasha'],
    'Dharmapasha': ['Dharmapasha Bazar', 'Sunamganj', 'Derai'],
    'Dowarabazar': ['Dowarabazar Bazar', 'Sunamganj', 'Chhatak'],
    'Jagannathpur': ['Jagannathpur Bazar', 'Sunamganj', 'Bishwamvarpur'],
    'Jamalganj': ['Jamalganj Bazar', 'Sunamganj', 'Tahirpur'],
    'Sulla': ['Sulla Bazar', 'Sunamganj', 'Dowarabazar'],

    // Mymensingh District - Missing
    'Ishwarganj': ['Ishwarganj Bazar', 'Mymensingh', 'Gaffargaon'],
    'Muktagachha': ['Muktagachha Bazar', 'Mymensingh', 'Nandail'],
    'Nandail': ['Nandail Bazar', 'Mymensingh', 'Muktagachha'],
    'Nandail': ['Nandail Bazar', 'Mymensingh', 'Muktagachha'],

    // Jamalpur District - Missing
    'Baksiganj': ['Baksiganj Bazar', 'Jamalpur', 'Dewangganj'],
    'Islampur': ['Islampur Bazar', 'Jamalpur', 'Madarganj'],
    'Madarganj': ['Madarganj Bazar', 'Jamalpur', 'Sarishabari'],
    'Melandaha': ['Melandaha Bazar', 'Jamalpur', 'Sarishabari'],

    // Netrokona District - Missing
    'Durgapur': ['Durgapur Bazar', 'Netrokona', 'Kalmakanda'],
    'Kalmakanda': ['Kalmakanda Bazar', 'Netrokona', 'Durgapur'],
    'Kendua': ['Kendua Bazar', 'Netrokona', 'Atpara'],
    'Madan': ['Madan Bazar', 'Netrokona', 'Khaliajuri'],
    'Mohanganj': ['Mohanganj Bazar', 'Netrokona', 'Durgapur'],

    // Sherpur District - Missing
    'Nakla': ['Nakla Bazar', 'Sherpur', 'Jhenaigati'],
    'Nalitabari': ['Nalitabari Bazar', 'Sherpur', 'Sreebardi'],

    // Bogra District - Missing
    'Bogra Sadar': ['Bogra Town', 'Sadar', 'Sherpur'],
    'Adamdighi': ['Adamdighi Bazar', 'Bogra', 'Dhunat'],
    'Dhunat': ['Dhunat Bazar', 'Bogra', 'Dhupchanchia'],
    'Dhupchanchia': ['Dhupchanchia Bazar', 'Bogra', 'Gabtali'],
    'Gabtali': ['Gabtali Bazar', 'Bogra', 'Sherpur'],
    'Kahaloo': ['Kahaloo Bazar', 'Bogra', 'Sherpur'],
    'Nandigram': ['Nandigram Bazar', 'Bogra', 'Sariakandi'],
    'Sariakandi': ['Sariakandi Bazar', 'Bogra', 'Sonatola'],
    'Shajahanpur': ['Shajahanpur Bazar', 'Bogra', 'Sherpur'],
    'Sherpur': ['Sherpur Bazar', 'Bogra', 'Shajahanpur'],
    'Shibganj': ['Shibganj Bazar', 'Bogra', 'Sariakandi'],
    'Sonatola': ['Sonatola Bazar', 'Bogra', 'Dhupchanchia'],

    // Chapainawabganj District - Missing
    'Chapainawabganj Sadar': ['Chapainawabganj Town', 'Sadar', 'Shibganj'],
    'Bholahat': ['Bholahat Bazar', 'Chapainawabganj', 'Gomastapur'],
    'Gomastapur': ['Gomastapur Bazar', 'Chapainawabganj', 'Bholahat'],
    'Nachole': ['Nachole Bazar', 'Chapainawabganj', 'Gomastapur'],
    'Shibganj': ['Shibganj Bazar', 'Chapainawabganj', 'Bholahat'],

    // Joypurhat District - Missing
    'Joypurhat Sadar': ['Joypurhat Town', 'Sadar', 'Akkelpur'],
    'Akkelpur': ['Akkelpur Bazar', 'Joypurhat', 'Kalai'],
    'Kalai': ['Kalai Bazar', 'Joypurhat', 'Khetlal'],
    'Khetlal': ['Khetlal Bazar', 'Joypurhat', 'Panchbibi'],
    'Panchbibi': ['Panchbibi Bazar', 'Joypurhat', 'Khetlal'],

    // Naogaon District - Missing
    'Naogaon Sadar': ['Naogaon Town', 'Sadar', 'Manda'],
    'Atrai': ['Atrai Bazar', 'Naogaon', 'Raninagar'],
    'Badalgachhi': ['Badalgachhi Bazar', 'Naogaon', 'Sapahar'],
    'Dhamoirhat': ['Dhamoirhat Bazar', 'Naogaon', 'Gobindaganj'],
    'Manda': ['Manda Bazar', 'Naogaon', 'Niamatpur'],
    'Mahadevpur': ['Mahadevpur Bazar', 'Naogaon', 'Patnitala'],
    'Niamatpur': ['Niamatpur Bazar', 'Naogaon', 'Manda'],
    'Patnitala': ['Patnitala Bazar', 'Naogaon', 'Mohadevpur'],
    'Porsha': ['Porsha Bazar', 'Naogaon', 'Rajshahi'],
    'Raninagar': ['Raninagar Bazar', 'Naogaon', 'Atrai'],
    'Sapahar': ['Sapahar Bazar', 'Naogaon', 'Badalgachhi'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Naogaon', 'Dhamoirhat'],

    // Natore District - Missing
    'Natore Sadar': ['Natore Town', 'Sadar', 'Bagatipara'],
    'Bagatipara': ['Bagatipara Bazar', 'Natore', 'Gurudaspur'],
    'Baraigram': ['Baraigram Bazar', 'Natore', 'Gurudaspur'],
    'Gurudaspur': ['Gurudaspur Bazar', 'Natore', 'Baraigram'],
    'Lalpur': ['Lalpur Bazar', 'Natore', 'Bagatipara'],
    'Singra': ['Singra Bazar', 'Natore', 'Baraigram'],
    'Naldanga': ['Naldanga Bazar', 'Natore', 'Sadar'],

    // Pabna District - Missing
    'Pabna Sadar': ['Pabna Town', 'Sadar', 'Atgharia'],
    'Atgharia': ['Atgharia Bazar', 'Pabna', 'Sujanagar'],
    'Bera': ['Bera Bazar', 'Pabna', 'Sathia'],
    'Bhangura': ['Bhangura Bazar', 'Pabna', 'Faridpur'],
    'Chatmohar': ['Chatmohar Bazar', 'Pabna', 'Bhangura'],
    'Faridpur': ['Faridpur Bazar', 'Pabna', 'Chatmohar'],
    'Ishwardi': ['Ishwardi Bazar', 'Pabna', 'Sadar'],
    'Santhia': ['Santhia Bazar', 'Pabna', 'Bhangura'],
    'Sujanagar': ['Sujanagar Bazar', 'Pabna', 'Atgharia'],

    // Sirajganj District - Missing
    'Sirajganj Sadar': ['Sirajganj Town', 'Sadar', 'Belkuchi'],
    'Belkuchi': ['Belkuchi Bazar', 'Sirajganj', 'Kazipur'],
    'Chauhali': ['Chauhali Bazar', 'Sirajganj', 'Shahjadpur'],
    'Kamarkhanda': ['Kamarkhanda Bazar', 'Sirajganj', 'Raiganj'],
    'Kazipur': ['Kazipur Bazar', 'Sirajganj', 'Belkuchi'],
    'Raiganj': ['Raiganj Bazar', 'Sirajganj', 'Tarash'],
    'Shahjadpur': ['Shahjadpur Bazar', 'Sirajganj', 'Ullapara'],
    'Tarash': ['Tarash Bazar', 'Sirajganj', 'Ullapara'],
    'Ullapara': ['Ullapara Bazar', 'Sirajganj', 'Enayetpur'],
    'Enayetpur': ['Enayetpur Bazar', 'Sirajganj', 'Ullapara'],

    // Cox's Bazar District - Missing
    "Cox's Bazar Sadar": ["Cox's Bazar Town", 'Sadar', 'Chakaria'],
    'Chakaria': ['Chakaria Bazar', "Cox's Bazar", 'Ramu'],
    'Kutubdia': ['Kutubdia Bazar', "Cox's Bazar", 'Maheshkhali'],
    'Maheshkhali': ['Maheshkhali Bazar', "Cox's Bazar", 'Kutubdia'],
    'Pekua': ['Pekua Bazar', "Cox's Bazar", 'Chakaria'],
    'Ramu': ['Ramu Bazar', "Cox's Bazar", 'Ukhia'],
    'Teknaf': ['Teknaf Bazar', "Cox's Bazar", 'St. Martin Island'],
    'Ukhia': ['Ukhia Bazar', "Cox's Bazar", 'Teknaf'],
    'Inani Beach': ['Inani Beach', "Cox's Bazar", 'Marine Drive'],
    'Laboni Beach': ['Laboni Beach', "Cox's Bazar", 'Kolatoli'],

    // Chattogram District - Missing
    'Chattogram Sadar': ['Chattogram Town', 'Sadar', 'Kotwali'],
    'Anwara': ['Anwara Bazar', 'Chattogram', 'Banshkhali'],
    'Banshkhali': ['Banshkhali Bazar', 'Chattogram', 'Patiya'],
    'Boalkhali': ['Boalkhali Bazar', 'Chattogram', 'Patiya'],
    'Chandanaish': ['Chandanaish Bazar', 'Chattogram', 'Satkania'],
    'Fatikchhari': ['Fatikchhari Bazar', 'Chattogram', 'Hathazari'],
    'Hathazari': ['Hathazari Bazar', 'Chattogram', 'Raozan'],
    'Karnaphuli': ['Karnaphuli Bazar', 'Chattogram', 'Patenga'],
    'Lohagara': ['Lohagara Bazar', 'Chattogram', 'Satkania'],
    'Mirsharai': ['Mirsharai Bazar', 'Chattogram', 'Sitakunda'],
    'Patiya': ['Patiya Bazar', 'Chattogram', 'Anwara'],
    'Patiya': ['Patiya Bazar', 'Chattogram', 'Chandanaish'],
    'Rangunia': ['Rangunia Bazar', 'Chattogram', 'Raozan'],
    'Raozan': ['Raozan Bazar', 'Chattogram', 'Rangunia'],
    'Sandwip': ['Sandwip Bazar', 'Sandwip Island', 'Chattogram Sadar'],
    'Satkania': ['Satkania Bazar', 'Chattogram', 'Lohagara'],
    'Sitakunda': ['Sitakunda Bazar', 'Chattogram', 'Hathazari'],
    'Pahartali': ['Pahartali', 'Chattogram', 'Agrabad'],
    'Chawkbazar': ['Chawkbazar', 'Andarkilla', 'Chattogram Sadar'],
    'Kattali': ['Kattali', 'Muradpur', 'Khulshi'],
    'Pahartali': ['Pahartali', 'Bayezid', 'Agrabad'],
    'C/E': ['C/E', 'Port Connecting Road', 'Halishahar'],
    'Port Connecting Road': ['Port Connecting Road', 'C/E', 'Halishahar'],
    'Andarkilla': ['Andarkilla', 'Chawkbazar', 'Chattogram Sadar'],

    // Gaibandha District - Missing
    'Gaibandha Sadar': ['Gaibandha Town', 'Sadar', 'Fulchhari'],
    'Fulchhari': ['Fulchhari Bazar', 'Gaibandha', 'Sundarganj'],
    'Gobindaganj': ['Gobindaganj Bazar', 'Gaibandha', 'Sadar'],
    'Sundarganj': ['Sundarganj Bazar', 'Gaibandha', 'Fulchhari'],
    'Saghata': ['Saghata Bazar', 'Gaibandha', 'Gobindaganj'],

    // Dinajpur District - Missing (completing all)
    'Dinajpur Sadar': ['Dinajpur Town', 'Sadar', 'Chirirbandar'],
    'Birampur': ['Birampur Bazar', 'Dinajpur', 'Birganj'],
    'Birganj': ['Birganj Bazar', 'Dinajpur', 'Phulbari'],
    'Biral': ['Biral Bazar', 'Dinajpur', 'Bochaganj'],
    'Bochaganj': ['Bochaganj Bazar', 'Dinajpur', 'Sadar'],
    'Fulbari': ['Fulbari Bazar', 'Dinajpur', 'Birganj'],
    'Ghoraghat': ['Ghoraghat Bazar', 'Dinajpur', 'Khansama'],
    'Hakimpur': ['Hakimpur Bazar', 'Dinajpur', 'Kaharole'],
    'Kaharole': ['Kaharole Bazar', 'Dinajpur', 'Khansama'],
    'Khansama': ['Khansama Bazar', 'Dinajpur', 'Chirirbandar'],
    'Nawabganj': ['Nawabganj Bazar', 'Dinajpur', 'Parbatipur'],
    'Parbatipur': ['Parbatipur Bazar', 'Dinajpur', 'Saidpur'],
    'Saidpur': ['Saidpur Town', 'Dinajpur', 'Parbatipur'],
    'Phulbari': ['Phulbari Bazar', 'Dinajpur', 'Chirirbandar'],
    'Bochaganj': ['Bochaganj Bazar', 'Dinajpur', 'Sadar'],

    // Jamalpur District - Missing upazillas
    'Bakshiganj': ['Bakshiganj Bazar', 'Jamalpur', 'Dewanganj'],
    'Dewanganj': ['Dewanganj Bazar', 'Jamalpur', 'Bakshiganj'],
    'Madarganj': ['Madarganj Bazar', 'Jamalpur', 'Islampur'],

    // Naogaon District - Missing
    'Mahadebpur': ['Mahadebpur Bazar', 'Naogaon', 'Patnitala'],

    // Sirajganj District - Missing
    'Ullahpara': ['Ullahpara Bazar', 'Sirajganj', 'Shahjadpur'],
    'Belkuchi': ['Belkuchi Bazar', 'Sirajganj', 'Chauhali'],
    'Chauhali': ['Chauhali Bazar', 'Sirajganj', 'Kamarkhanda'],
    'Kazipur': ['Kazipur Bazar', 'Sirajganj', 'Raiganj'],
    'Tarash': ['Tarash Bazar', 'Sirajganj', 'Ullahpara'],

    // Bogra District - Missing
    'Adamdighi': ['Adamdighi Bazar', 'Bogra', 'Dhunat'],
    'Dhunat': ['Dhunat Bazar', 'Bogra', 'Sherpur'],
    'Dhupchanchia': ['Dhupchanchia Bazar', 'Bogra', 'Kahaloo'],
    'Gabtali': ['Gabtali Bazar', 'Bogra', 'Sherpur'],
    'Kahaloo': ['Kahaloo Bazar', 'Bogra', 'Nandigram'],
    'Nandigram': ['Nandigram Bazar', 'Bogra', 'Sariakandi'],
    'Sariakandi': ['Sariakandi Bazar', 'Bogra', 'Sherpur'],
    'Shajahanpur': ['Shajahanpur Bazar', 'Bogra', 'Sherpur'],
    'Sherpur Bogra': ['Sherpur Bazar', 'Bogra', 'Sariakandi'],
    'Shibganj Bogra': ['Shibganj Bazar', 'Bogra', 'Sonatola'],
    'Sonatola': ['Sonatola Bazar', 'Bogra', 'Sherpur'],

    // Chapainawabganj District - Missing
    'Bholahat': ['Bholahat Bazar', 'Chapainawabganj', 'Gomastapur'],
    'Gomastapur': ['Gomastapur Bazar', 'Chapainawabganj', 'Shibganj'],
    'Nachole': ['Nachole Bazar', 'Chapainawabganj', 'Shibganj'],
    'Shibganj Chapai': ['Shibganj Bazar', 'Chapainawabganj', 'Nachole'],

    // Joypurhat District - Missing
    'Akkelpur': ['Akkelpur Bazar', 'Joypurhat', 'Khetlal'],
    'Kalai': ['Kalai Bazar', 'Joypurhat', 'Akkelpur'],
    'Khetlal': ['Khetlal Bazar', 'Joypurhat', 'Kalai'],
    'Panchbibi': ['Panchbibi Bazar', 'Joypurhat', 'Kalai'],

    // Naogaon District - Additional missing
    'Atrai': ['Atrai Bazar', 'Naogaon', 'Raninagar'],
    'Badalgachhi': ['Badalgachhi Bazar', 'Naogaon', 'Atrai'],
    'Dhamoirhat': ['Dhamoirhat Bazar', 'Naogaon', 'Patnitala'],
    'Manda': ['Manda Bazar', 'Naogaon', 'Mohadebpur'],
    'Niamatpur': ['Niamatpur Bazar', 'Naogaon', 'Manda'],
    'Patnitala': ['Patnitala Bazar', 'Naogaon', 'Dhamoirhat'],
    'Porsha': ['Porsha Bazar', 'Naogaon', 'Tribeni'],
    'Raninagar': ['Raninagar Bazar', 'Naogaon', 'Atrai'],
    'Sapahar': ['Sapahar Bazar', 'Naogaon', 'Porsha'],

    // Natore District - Missing
    'Bagatipara': ['Bagatipara Bazar', 'Natore', 'Lalpur'],
    'Baraigram': ['Baraigram Bazar', 'Natore', 'Bagatipara'],
    'Gurudaspur': ['Gurudaspur Bazar', 'Natore', 'Baraigram'],
    'Lalpur': ['Lalpur Bazar', 'Natore', 'Bagatipara'],
    'Singra': ['Singra Bazar', 'Natore', 'Gurudaspur'],

    // Pabna District - Missing
    'Atgharia': ['Atgharia Bazar', 'Pabna', 'Chatmohar'],
    'Bera': ['Bera Bazar', 'Pabna', 'Santhia'],
    'Bhangura': ['Bhangura Bazar', 'Pabna', 'Ishwardi'],
    'Chatmohar': ['Chatmohar Bazar', 'Pabna', 'Faridpur Pabna'],
    'Faridpur Pabna': ['Faridpur Bazar', 'Pabna', 'Bhangura'],
    'Ishwardi': ['Ishwardi Bazar', 'Pabna', 'Pabna Sadar'],
    'Santhia': ['Santhia Bazar', 'Pabna', 'Bera'],
    'Sujanagar': ['Sujanagar Bazar', 'Pabna', 'Atgharia'],

    // Kurigram District - Missing
    'Bhurungamari': ['Bhurungamari Bazar', 'Kurigram', 'Rajarhat'],
    'Char Rajibpur': ['Char Rajibpur Bazar', 'Kurigram', 'Chilmari'],
    'Chilmari': ['Chilmari Bazar', 'Kurigram', 'Ulipur'],
    'Nageshwari': ['Nageshwari Bazar', 'Kurigram', 'Bhurungamari'],
    'Phulbari Kurigram': ['Phulbari Bazar', 'Kurigram', 'Rajarhat'],
    'Rajarhat': ['Rajarhat Bazar', 'Kurigram', 'Phulbari'],
    'Raumari': ['Raumari Bazar', 'Kurigram', 'Chilmari'],
    'Ulipur': ['Ulipur Bazar', 'Kurigram', 'Chilmari'],

    // Lalmonirhat District - Missing
    'Aditmari': ['Aditmari Bazar', 'Lalmonirhat', 'Hatibandha'],
    'Hatibandha': ['Hatibandha Bazar', 'Lalmonirhat', 'Patgram'],
    'Kaliganj Lalmonirhat': ['Kaliganj Bazar', 'Lalmonirhat', 'Aditmari'],
    'Patgram': ['Patgram Bazar', 'Lalmonirhat', 'Hatibandha'],

    // Nilphamari District - Missing
    'Dimla': ['Dimla Bazar', 'Nilphamari', 'Jaldhaka'],
    'Domar': ['Domar Bazar', 'Nilphamari', 'Dimla'],
    'Jaldhaka': ['Jaldhaka Bazar', 'Nilphamari', 'Domar'],
    'Kishoreganj Nilphamari': ['Kishoreganj Bazar', 'Nilphamari', 'Jaldhaka'],

    // Panchagarh District - Missing
    'Atwari': ['Atwari Bazar', 'Panchagarh', 'Boda'],
    'Boda': ['Boda Bazar', 'Panchagarh', 'Debiganj'],
    'Debiganj': ['Debiganj Bazar', 'Panchagarh', 'Tetulia'],
    'Tetulia': ['Tetulia Bazar', 'Panchagarh', 'Debiganj'],

    // Thakurgaon District - Missing
    'Baliadangi': ['Baliadangi Bazar', 'Thakurgaon', 'Haripur'],
    'Haripur': ['Haripur Bazar', 'Thakurgaon', 'Pirganj'],
    'Pirganj Thakurgaon': ['Pirganj Bazar', 'Thakurgaon', 'Ranisankail'],
    'Ranisankail': ['Ranisankail Bazar', 'Thakurgaon', 'Pirganj'],

    // Gaibandha District - Missing
    'Palashbari': ['Palashbari Bazar', 'Gaibandha', 'Gobindaganj'],
    'Sadullapur': ['Sadullapur Bazar', 'Gaibandha', 'Palashbari'],
    'Saghatta': ['Saghatta Bazar', 'Gaibandha', 'Gobindaganj'],

    // Netrokona District - Missing
    'Atpara': ['Atpara Bazar', 'Netrokona', 'Kendua'],
    'Barhatta': ['Barhatta Bazar', 'Netrokona', 'Durgapur'],
    'Durgapur': ['Durgapur Bazar', 'Netrokona', 'Kalmakanda'],
    'Kalmakanda': ['Kalmakanda Bazar', 'Netrokona', 'Durgapur'],
    'Kendua': ['Kendua Bazar', 'Netrokona', 'Atpara'],
    'Khaliajuri': ['Khaliajuri Bazar', 'Netrokona', 'Madan'],
    'Madan': ['Madan Bazar', 'Netrokona', 'Khaliajuri'],
    'Mohanganj': ['Mohanganj Bazar', 'Netrokona', 'Khaliajuri'],
    'Purbadhala': ['Purbadhala Bazar', 'Netrokona', 'Durgapur'],

    // Sherpur District - Missing
    'Jhenaigati': ['Jhenaigati Bazar', 'Sherpur', 'Nakla'],
    'Nakla': ['Nakla Bazar', 'Sherpur', 'Sreebardi'],
    'Nalitabari': ['Nalitabari Bazar', 'Sherpur', 'Jhenaigati'],
    'Sreebardi': ['Sreebardi Bazar', 'Sherpur', 'Nakla'],

    // Jamalpur District - Remaining missing
    'Islampur Jamalpur': ['Islampur Bazar', 'Jamalpur', 'Dewanganj'],
    'Melandaha': ['Melandaha Bazar', 'Jamalpur', 'Madarganj'],
    'Sarishabari': ['Sarishabari Bazar', 'Jamalpur', 'Islampur'],

    // Additional areas for major cities
    "Cox's Bazar": ["Cox's Bazar Town", 'Kolatoli', 'Laboni Beach', 'Sugandha Beach', 'Himchhari', 'Inani Beach', 'Marine Drive'],
};

// Categories for property
export const categories = [
    'Family',
    'Bachelor',
    'Office',
    'Sublet',
    'Hostel',
    'Shop',
    'Warehouse',
    'Factory'
];

// Room options
export const roomOptions = ['1', '2', '3', '4', '5', '5+'];

// Months for "Property need from"
export const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

// Helper function to get districts by division
export const getDistrictsByDivision = (division) => {
    return districts[division] || [];
};

// Helper function to get areas by district
export const getAreasByDistrict = (district) => {
    return areas[district] || [];
};

// Helper function to get sub-areas by area
export const getSubAreasByArea = (area) => {
    return subAreas[area] || [];
};
