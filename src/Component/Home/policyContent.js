import { SITE_CONTACT } from '../../config/siteContact.js'

const companyName = SITE_CONTACT.companyName
const websiteUrl = SITE_CONTACT.websiteUrl
const supportEmail = SITE_CONTACT.email
const supportPhone = SITE_CONTACT.phoneDisplay
const supportAddress = SITE_CONTACT.addressEn

export const termsPolicy = {
  en: {
    badge: 'Terms & Conditions',
    breadcrumbLabel: 'Terms & Conditions',
    title: 'Terms & Conditions',
    updatedAt: 'March 1, 2026',
    intro:
      `${companyName} connects property owners and property seekers through a digital listing and order platform. Please read these terms carefully before using our site, services, orders, credits, and communication features.`,
    sections: [
      {
        title: 'General',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              `${companyName} is a platform for connecting property owners, agents, and tenants. We do not act as a party to rental contracts and we do not guarantee the conduct, identity, or performance of any user on the platform.`,
          },
          {
            type: 'paragraph',
            text:
              'Users must independently verify listings, contacts, payments, and decisions before entering into any agreement or transferring funds.',
          },
        ],
      },
      {
        title: 'Account Information',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'Users must provide accurate account details, including real name and valid phone number.',
              'Fake, misleading, or duplicate accounts may be suspended, limited, or permanently removed.',
              'Email and profile data may be used for login, verification, notices, service updates, and support communication.',
              'Profile images, when used, should represent the actual person or organization behind the account.',
            ],
          },
        ],
      },
      {
        title: 'Property Listings',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'Anyone posting a property confirms that they are the rightful owner or have the authority to advertise it.',
              'Listing details including location, pricing, room counts, availability, and images must be accurate and kept updated.',
              'We may edit, reject, hide, or remove listings that appear misleading, unlawful, abusive, or in conflict with platform rules.',
              'Personal contact details are not allowed inside property descriptions if the platform already provides a structured contact method.',
            ],
          },
        ],
      },
      {
        title: 'Credits, Orders, and Platform Services',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'Some platform features may require credits or direct payment before access is granted.',
              'Orders are not approved until full payment has been successfully completed.',
              'Order progress may be communicated by SMS, phone, or other official support channels chosen by NewTolet.',
              'Matches are prepared according to the requirements submitted through the order form. Extra expectations outside the submitted form may not be fulfilled.',
              'NewTolet may limit each order to the most suitable option unless a specific support exception is applied.',
            ],
          },
        ],
      },
      {
        title: 'Complaints, Completion, and Refund Handling',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'Once an order is marked complete, complaints should be reported within 24 hours of the completion notice.',
              'After contact is established between landlord and tenant, personal disputes or changes of preference are outside NewTolet responsibility.',
              'Refund handling, cancellation conditions, and service deductions are governed by the Refund Policy published on the platform.',
            ],
          },
        ],
      },
      {
        title: 'Cookies',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              'We may use cookies and related storage mechanisms to maintain sessions, improve site performance, remember preferences, and secure account activity. Some parts of the site may not function correctly without them.',
          },
        ],
      },
      {
        title: 'Contact',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              `Email: ${supportEmail}`,
              `Phone: ${supportPhone}`,
              `Address: ${supportAddress}`,
              `Website: ${websiteUrl}`,
            ],
          },
        ],
      },
    ],
  },
  bn: {
    badge: 'নিয়ম ও শর্তাবলী',
    breadcrumbLabel: 'নিয়ম ও শর্তাবলী',
    title: 'নিয়ম ও শর্তাবলী',
    updatedAt: '1 মার্চ 2026',
    intro:
      `${companyName} একটি ডিজিটাল লিস্টিং ও অর্ডার প্ল্যাটফর্মের মাধ্যমে প্রপার্টির মালিক ও প্রপার্টি খোঁজা ব্যক্তিদের সংযুক্ত করে। আমাদের সাইট, সার্ভিস, অর্ডার, ক্রেডিট ও যোগাযোগ ফিচার ব্যবহারের আগে অনুগ্রহ করে এই শর্তাবলী মনোযোগ দিয়ে পড়ুন।`,
    sections: [
      {
        title:
          'সাধারণ নীতিমালা',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              `${companyName} বাড়িওয়ালা, এজেন্ট এবং ভাড়াটিয়াদের মধ্যে যোগাযোগের একটি প্ল্যাটফর্ম। ব্যবহারকারীদের নিজ নিজ পোস্ট, তথ্য, যোগাযোগ এবং আর্থিক সিদ্ধান্তের দায় নিজেকেই নিতে হবে।`,
          },
          {
            type: 'paragraph',
            text:
              `${companyName} সরাসরি কোনো ভাড়া চুক্তি, নগদ লেনদেন, মালিক-ভাড়াটিয়া বিরোধ, প্রতারণা, বা ভুল তথ্যের দায় নেবে না। ব্যবহারকারীদের সব তথ্য যাচাই করে সিদ্ধান্ত নেওয়ার পরামর্শ দেওয়া হয়।`,
          },
        ],
      },
      {
        title: 'অ্যাকাউন্ট তথ্য',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'প্রতিটি ব্যবহারকারীকে সঠিক নাম, ফোন নম্বর এবং প্রয়োজনীয় প্রোফাইল তথ্য ব্যবহার করতে হবে।',
              'ভুয়া অ্যাকাউন্ট, বিভ্রান্তিকর পরিচয়, বা জাল তথ্য যাচাই হলে অ্যাকাউন্ট স্থায়ীভাবে বন্ধ করা হতে পারে।',
              'ইমেইল এবং ব্যক্তিগত তথ্য প্ল্যাটফর্ম পরিচালনা, নোটিফিকেশন এবং সাপোর্টের জন্য ব্যবহার করা হতে পারে।',
              'প্রোফাইল ছবি ব্যবহার করলে তা আসল ব্যক্তি বা বৈধ প্রতিষ্ঠানের পরিচয় উপস্থাপন করতে হবে।',
            ],
          },
        ],
      },
      {
        title: 'পোস্ট ও লিস্টিং নিয়ম',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'যে কোনো মালিক বা এজেন্ট কেবলমাত্র এমন সম্পত্তিই পোস্ট করতে পারবেন যার জন্য তিনি অনুমোদিত।',
              'লোকেশন, ভাড়া, রুম, বাথরুম, প্রাপ্যতা, ছবি এবং অন্যান্য বিবরণ বাস্তব ও আপডেটেড হতে হবে।',
              'বিভ্রান্তিকর, অশালীন, কপিরাইট লঙ্ঘনকারী, বা আইনবিরোধী কনটেন্ট সরিয়ে ফেলার অধিকার NewTolet সংরক্ষণ করে।',
              'প্রপার্টি বর্ণনার মধ্যে ব্যক্তিগত যোগাযোগের তথ্য দেওয়া হলে তা সম্পাদনা, লুকানো বা অপসারণ করা হতে পারে।',
            ],
          },
        ],
      },
      {
        title: 'ক্রেডিট ও অর্ডার সিস্টেম',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'কিছু সার্ভিস ব্যবহারের জন্য ক্রেডিট বা অর্থপ্রদানের প্রয়োজন হতে পারে।',
              'পূর্ণ অর্থপ্রদান সম্পন্ন না হলে কোনো অর্ডার অনুমোদিত হবে না।',
              'অর্ডারের আপডেট ফোনকলের পরিবর্তে SMS বা প্ল্যাটফর্মভিত্তিক আপডেটের মাধ্যমে দেওয়া হতে পারে।',
              'ফর্মে দেওয়া চাহিদা অনুযায়ী মিল খোঁজা হয়; পরবর্তীতে নতুন শর্ত যোগ হলে তা আলাদাভাবে বিবেচিত হবে।',
              'একটি অর্ডার থেকে সাধারণত একটি প্রধান উপযুক্ত অপশন সরবরাহ করা হয়, যদি না ব্যতিক্রমী পরিস্থিতি থাকে।',
            ],
          },
        ],
      },
      {
        title: 'অর্ডার, অভিযোগ ও রিফান্ড সম্পর্কিত শর্ত',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'অর্ডার সম্পন্ন হলে SMS বা অন্য স্বীকৃত মাধ্যমে গ্রাহককে জানানো হবে।',
              'সার্ভিস নিয়ে অভিযোগ থাকলে সম্পন্ন হওয়ার নোটিফিকেশন পাওয়ার ২৪ ঘণ্টার মধ্যে জানাতে হবে।',
              'মালিকের সঙ্গে যোগাযোগ স্থাপনের পর ব্যক্তি-ব্যক্তি বিরোধ, মতভেদ বা পছন্দ পরিবর্তনের দায় NewTolet নেবে না।',
              'অর্ডার করার পর বাজেট বা লোকেশন কমানো সাধারণত সম্ভব নয়; তবে বাজেট বাড়ানো, নতুন লোকেশন যোগ করা বা সময়সীমা বাড়ানো বিবেচনা করা যেতে পারে।',
              'রিফান্ড এবং অর্ডার বাতিলের বিস্তারিত শর্ত আলাদা Refund Policy পৃষ্ঠায় বর্ণিত আছে।',
            ],
          },
        ],
      },
      {
        title: 'কুকিজ ও ব্যবহার',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              'এই ওয়েবসাইটের কিছু ফিচার সঠিকভাবে কাজ করার জন্য কুকিজ, সেশন ডেটা এবং ডিভাইস-লেভেল তথ্য ব্যবহার করা হতে পারে। ব্রাউজারে কুকিজ বন্ধ থাকলে কিছু ফিচার সীমিত হতে পারে।',
          },
        ],
      },
      {
        title: 'যোগাযোগ',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              `ইমেইল: ${supportEmail}`,
              `ফোন: ${supportPhone}`,
              `ঠিকানা: ${supportAddress}`,
              `ওয়েবসাইট: ${websiteUrl}`,
            ],
          },
        ],
      },
    ],
  },
}

export const privacyPolicy = {
  en: {
    badge: 'Privacy Policy',
    breadcrumbLabel: 'Privacy Policy',
    title: 'Privacy Policy',
    updatedAt: 'July 1, 2025',
    intro:
      `This Privacy Policy explains how ${companyName} collects, uses, stores, shares, and protects your information when you use our website, account system, property listing features, and order services.`,
    sections: [
      {
        title: 'Interpretation and Definitions',
        level: 2,
        sections: [
          {
            title: 'Definitions',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  `"Company", "we", "our", and "us" refer to ${companyName}.`,
                  '"Account" means a user profile created to access services on the platform.',
                  '"Personal Data" means information that can identify or be linked to an individual.',
                  '"Usage Data" means technical or analytical information collected through normal use of the website or app.',
                  '"Website" means the NewTolet service available at the official site URL.',
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Information We Collect',
        level: 2,
        sections: [
          {
            title: 'Personal Data',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  'Name, email address, phone number, address or location information, and account profile details.',
                  'Property-related information submitted through listings, inquiries, orders, support forms, and profile settings.',
                  'Identity or verification material that you voluntarily submit for trust, moderation, or compliance workflows.',
                ],
              },
            ],
          },
          {
            title: 'Usage Data',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  'IP address, browser type, browser version, visited pages, timestamps, and time spent on the platform.',
                  'Device identifiers, operating system information, and diagnostic data used to improve reliability and security.',
                ],
              },
            ],
          },
          {
            title: 'Cookies and Tracking Technologies',
            level: 3,
            content: [
              {
                type: 'paragraph',
                text:
                  'We use cookies, local storage, session storage, and similar tools to keep you signed in, remember settings, protect accounts, understand usage patterns, and improve performance.',
              },
            ],
          },
        ],
      },
      {
        title: 'How We Use Personal Data',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              'To create and manage your account.',
              'To operate listings, saved properties, orders, support, and payment-related workflows.',
              'To contact you by email, phone, SMS, or platform notifications when required for service delivery or account security.',
              'To analyze service quality, measure performance, detect abuse, and improve the user experience.',
              'To comply with legal requirements, resolve disputes, and enforce platform rules.',
            ],
          },
        ],
      },
      {
        title: 'How We May Share Information',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              'With service providers who help us operate infrastructure, analytics, communication, moderation, or support systems.',
              'With business or operational partners when needed to deliver services requested by you.',
              'With other users only through the platform features you intentionally use, such as listing, inquiry, or profile visibility.',
              'With legal authorities when required by law, court order, or a legitimate safety and fraud-prevention need.',
            ],
          },
        ],
      },
      {
        title: 'Data Retention',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'We keep personal data only for as long as it is reasonably necessary for the purposes described in this policy, including service delivery, dispute resolution, legal compliance, fraud prevention, and policy enforcement.',
          },
        ],
      },
      {
        title: 'Transfer and Security',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'Your information may be processed on systems operated by us or our service providers. We take reasonable technical and organizational steps to protect stored data, but no online system can promise absolute security.',
          },
        ],
      },
      {
        title: 'Your Rights and Data Deletion',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'You may request review, correction, or deletion of your information by contacting us from your registered account details. We may need to verify your identity before processing a deletion or privacy-related request.',
          },
          {
            type: 'list',
            items: [
              `Email deletion and privacy requests to: ${supportEmail}`,
              `Support phone: ${supportPhone}`,
            ],
          },
        ],
      },
      {
        title: "Children's Privacy",
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'Our services are not directed to children under 13. We do not knowingly collect personal information from children without lawful permission. If such data is identified, we will take reasonable steps to remove it.',
          },
        ],
      },
      {
        title: 'Links to Other Websites',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'Our platform may contain links to third-party websites or services. We do not control their content, privacy practices, or security standards, and we encourage you to review their policies before using them.',
          },
        ],
      },
      {
        title: 'Changes to This Privacy Policy',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'We may revise this Privacy Policy from time to time. When material changes are made, we may update the published date and display the revised version on this page.',
          },
        ],
      },
      {
        title: 'Contact Us',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              `Company: ${companyName}`,
              `Email: ${supportEmail}`,
              `Phone: ${supportPhone}`,
              `Address: ${supportAddress}`,
              `Website: ${websiteUrl}`,
            ],
          },
        ],
      },
    ],
  },
  bn: {
    badge: 'প্রাইভেসি পলিসি',
    breadcrumbLabel: 'প্রাইভেসি পলিসি',
    title: 'প্রাইভেসি পলিসি',
    updatedAt: '1 জুলাই 2025',
    intro:
      `এই প্রাইভেসি পলিসিতে ব্যাখ্যা করা হয়েছে, আপনি আমাদের ওয়েবসাইট, অ্যাকাউন্ট সিস্টেম, প্রপার্টি লিস্টিং ফিচার ও অর্ডার সার্ভিস ব্যবহার করার সময় ${companyName} কীভাবে আপনার তথ্য সংগ্রহ, ব্যবহার, সংরক্ষণ, শেয়ার ও সুরক্ষিত করে।`,
    sections: [
      {
        title: 'ব্যাখ্যা ও সংজ্ঞা',
        level: 2,
        sections: [
          {
            title: 'সংজ্ঞা',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  `"কোম্পানি", "আমরা" এবং "আমাদের" বলতে ${companyName}-কে বোঝানো হয়েছে।`,
                  '"অ্যাকাউন্ট" বলতে প্ল্যাটফর্মের সার্ভিস ব্যবহারের জন্য তৈরি করা ব্যবহারকারীর প্রোফাইল বোঝানো হয়েছে।',
                  '"ব্যক্তিগত তথ্য" বলতে এমন তথ্য বোঝানো হয়েছে, যা দিয়ে কোনো ব্যক্তিকে শনাক্ত করা যায় বা তার সঙ্গে সম্পর্কযুক্ত করা যায়।',
                  '"ব্যবহার সংক্রান্ত তথ্য" বলতে ওয়েবসাইট বা অ্যাপের স্বাভাবিক ব্যবহারের মধ্য দিয়ে সংগৃহীত কারিগরি বা বিশ্লেষণমূলক তথ্য বোঝানো হয়েছে।',
                  '"ওয়েবসাইট" বলতে অফিসিয়াল সাইট URL-এ উপলব্ধ NewTolet সার্ভিস বোঝানো হয়েছে।',
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'আমরা যে তথ্য সংগ্রহ করি',
        level: 2,
        sections: [
          {
            title: 'ব্যক্তিগত তথ্য',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  'নাম, ইমেইল ঠিকানা, ফোন নম্বর, ঠিকানা বা লোকেশন সংক্রান্ত তথ্য এবং অ্যাকাউন্ট প্রোফাইলের বিবরণ।',
                  'লিস্টিং, ইনকোয়্যারি, অর্ডার, সাপোর্ট ফর্ম ও প্রোফাইল সেটিংসের মাধ্যমে জমা দেওয়া প্রপার্টি-সংক্রান্ত তথ্য।',
                  'বিশ্বাসযোগ্যতা, মডারেশন বা নিয়ম পরিপালনের প্রয়োজনে আপনি স্বেচ্ছায় জমা দেওয়া পরিচয় বা যাচাইকরণ সংক্রান্ত নথি।',
                ],
              },
            ],
          },
          {
            title: 'ব্যবহার সংক্রান্ত তথ্য',
            level: 3,
            content: [
              {
                type: 'list',
                items: [
                  'IP ঠিকানা, ব্রাউজারের ধরন, ব্রাউজার ভার্সন, ভিজিট করা পেজ, সময়সূচি এবং প্ল্যাটফর্মে ব্যয় করা সময়।',
                  'ডিভাইস শনাক্তকারী, অপারেটিং সিস্টেমের তথ্য এবং নির্ভরযোগ্যতা ও নিরাপত্তা উন্নত করার জন্য ব্যবহৃত ডায়াগনস্টিক ডেটা।',
                ],
              },
            ],
          },
          {
            title: 'কুকিজ ও ট্র্যাকিং প্রযুক্তি',
            level: 3,
            content: [
              {
                type: 'paragraph',
                text:
                  'আপনাকে লগইন অবস্থায় রাখা, সেটিংস মনে রাখা, অ্যাকাউন্ট সুরক্ষিত রাখা, ব্যবহারের ধরন বোঝা এবং পারফরম্যান্স উন্নত করার জন্য আমরা কুকিজ, লোকাল স্টোরেজ, সেশন স্টোরেজ ও এ ধরনের টুল ব্যবহার করি।',
              },
            ],
          },
        ],
      },
      {
        title: 'ব্যক্তিগত তথ্য আমরা কীভাবে ব্যবহার করি',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              'আপনার অ্যাকাউন্ট তৈরি ও পরিচালনা করতে।',
              'লিস্টিং, সংরক্ষিত প্রপার্টি, অর্ডার, সাপোর্ট এবং পেমেন্ট-সংক্রান্ত কার্যক্রম পরিচালনা করতে।',
              'সার্ভিস প্রদান বা অ্যাকাউন্টের নিরাপত্তার প্রয়োজনে ইমেইল, ফোন, SMS বা প্ল্যাটফর্ম নোটিফিকেশনের মাধ্যমে আপনার সঙ্গে যোগাযোগ করতে।',
              'সার্ভিসের মান বিশ্লেষণ, পারফরম্যান্স পরিমাপ, অপব্যবহার শনাক্ত এবং ব্যবহারকারীর অভিজ্ঞতা উন্নত করতে।',
              'আইনি বাধ্যবাধকতা পালন, বিরোধ নিষ্পত্তি এবং প্ল্যাটফর্মের নিয়ম কার্যকর করতে।',
            ],
          },
        ],
      },
      {
        title: 'আমরা কীভাবে তথ্য শেয়ার করতে পারি',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              'ইনফ্রাস্ট্রাকচার, অ্যানালিটিক্স, যোগাযোগ, মডারেশন বা সাপোর্ট সিস্টেম পরিচালনায় সহায়তা করে এমন সার্ভিস প্রোভাইডারদের সঙ্গে।',
              'আপনার অনুরোধ করা সার্ভিস প্রদানের জন্য প্রয়োজন হলে ব্যবসায়িক বা পরিচালনাগত অংশীদারদের সঙ্গে।',
              'অন্য ব্যবহারকারীদের সঙ্গে শুধুমাত্র আপনি ইচ্ছাকৃতভাবে ব্যবহার করা প্ল্যাটফর্ম ফিচারের মাধ্যমে, যেমন লিস্টিং, ইনকোয়্যারি বা প্রোফাইল দৃশ্যমানতা।',
              'আইন, আদালতের আদেশ বা নিরাপত্তা ও জালিয়াতি প্রতিরোধের যুক্তিসংগত প্রয়োজনে আইনি কর্তৃপক্ষের সঙ্গে।',
            ],
          },
        ],
      },
      {
        title: 'তথ্য সংরক্ষণের মেয়াদ',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'সার্ভিস প্রদান, বিরোধ নিষ্পত্তি, আইনি বাধ্যবাধকতা পালন, জালিয়াতি প্রতিরোধ এবং পলিসি কার্যকর করাসহ এই পলিসিতে বর্ণিত উদ্দেশ্যগুলোর জন্য যুক্তিসংগতভাবে যতদিন প্রয়োজন, কেবল ততদিনই আমরা ব্যক্তিগত তথ্য সংরক্ষণ করি।',
          },
        ],
      },
      {
        title: 'তথ্য স্থানান্তর ও নিরাপত্তা',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'আপনার তথ্য আমাদের বা আমাদের সার্ভিস প্রোভাইডারদের পরিচালিত সিস্টেমে প্রসেস করা হতে পারে। সংরক্ষিত তথ্য সুরক্ষায় আমরা যুক্তিসংগত কারিগরি ও সাংগঠনিক পদক্ষেপ নিই, তবে কোনো অনলাইন সিস্টেমই শতভাগ নিরাপত্তার নিশ্চয়তা দিতে পারে না।',
          },
        ],
      },
      {
        title: 'আপনার অধিকার ও তথ্য মুছে ফেলা',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'আপনার নিবন্ধিত অ্যাকাউন্টের তথ্য থেকে আমাদের সঙ্গে যোগাযোগ করে আপনি আপনার তথ্য পর্যালোচনা, সংশোধন বা মুছে ফেলার অনুরোধ করতে পারেন। তথ্য মুছে ফেলা বা গোপনীয়তা-সংক্রান্ত অনুরোধ প্রসেস করার আগে আমাদের আপনার পরিচয় যাচাই করার প্রয়োজন হতে পারে।',
          },
          {
            type: 'list',
            items: [
              `তথ্য মুছে ফেলা ও গোপনীয়তা-সংক্রান্ত অনুরোধ ইমেইল করুন: ${supportEmail}`,
              `সাপোর্ট ফোন: ${supportPhone}`,
            ],
          },
        ],
      },
      {
        title: 'শিশুদের গোপনীয়তা',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'আমাদের সার্ভিস ১৩ বছরের কম বয়সী শিশুদের জন্য নয়। বৈধ অনুমতি ছাড়া আমরা জ্ঞাতসারে শিশুদের ব্যক্তিগত তথ্য সংগ্রহ করি না। এমন কোনো তথ্য শনাক্ত হলে আমরা তা সরিয়ে ফেলার যুক্তিসংগত পদক্ষেপ নেব।',
          },
        ],
      },
      {
        title: 'অন্য ওয়েবসাইটের লিংক',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'আমাদের প্ল্যাটফর্মে তৃতীয় পক্ষের ওয়েবসাইট বা সার্ভিসের লিংক থাকতে পারে। তাদের কনটেন্ট, গোপনীয়তা চর্চা বা নিরাপত্তা মানের ওপর আমাদের কোনো নিয়ন্ত্রণ নেই; সেগুলো ব্যবহারের আগে তাদের পলিসি পড়ে নেওয়ার পরামর্শ দিচ্ছি।',
          },
        ],
      },
      {
        title: 'এই প্রাইভেসি পলিসিতে পরিবর্তন',
        level: 2,
        content: [
          {
            type: 'paragraph',
            text:
              'আমরা সময়ে সময়ে এই প্রাইভেসি পলিসি সংশোধন করতে পারি। গুরুত্বপূর্ণ কোনো পরিবর্তন হলে আমরা প্রকাশের তারিখ হালনাগাদ করে সংশোধিত সংস্করণ এই পেজে প্রদর্শন করতে পারি।',
          },
        ],
      },
      {
        title: 'আমাদের সঙ্গে যোগাযোগ',
        level: 2,
        content: [
          {
            type: 'list',
            items: [
              `কোম্পানি: ${companyName}`,
              `ইমেইল: ${supportEmail}`,
              `ফোন: ${supportPhone}`,
              `ঠিকানা: ${supportAddress}`,
              `ওয়েবসাইট: ${websiteUrl}`,
            ],
          },
        ],
      },
    ],
  },
}

export const refundPolicy = {
  en: {
    badge: 'Refund Policy',
    breadcrumbLabel: 'Refund Policy',
    title: 'Refund Policy',
    updatedAt: 'January 10, 2026',
    intro:
      `This Refund Policy explains how ${companyName} handles property-order refunds, service deductions, and credit returns. These rules apply together with the platform Terms & Conditions and any order-specific communication sent by support.`,
    sections: [
      {
        title: 'Cash Refunds for Property Orders',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'A cash refund may be considered if we fail to provide a suitable property match within the agreed order window.',
              'A 200 BDT service deduction may be retained as a minimum house-search and processing cost before any remaining amount is refunded.',
              'Valid refund requests are generally processed within 72 hours in sequence, excluding Fridays, Saturdays, and public holidays.',
              'Refunds are usually not available for complaints submitted more than 24 hours after completion notice, or for personal disputes arising after landlord contact is established.',
              `${companyName} reserves the final right to cancel an order and determine whether the refund policy applies.`,
            ],
          },
        ],
      },
      {
        title: 'Credit Refunds',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              'Cash is not refunded against purchased credits. However, used credits may be restored to the user account if an unlocked property is confirmed to be refund-eligible after review.',
          },
          {
            type: 'list',
            items: [
              'The property was already rented out before the user could act on it.',
              'The listed phone number remained unreachable after repeated reasonable attempts.',
              'The actual property location materially differed from the published location details.',
              'The refund request was submitted within 72 hours of unlocking the property.',
            ],
          },
        ],
      },
      {
        title: 'Customer Support',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              `Email: ${supportEmail}`,
              `Phone: ${supportPhone}`,
              `Address: ${supportAddress}`,
            ],
          },
        ],
      },
    ],
  },
  bn: {
    badge: 'রিফান্ড পলিসি',
    breadcrumbLabel: 'রিফান্ড পলিসি',
    title: 'রিফান্ড পলিসি',
    updatedAt: '10 জানুয়ারি 2026',
    intro:
      `এই রিফান্ড পলিসিতে ব্যাখ্যা করা হয়েছে, ${companyName} কীভাবে প্রপার্টি অর্ডারের রিফান্ড, সার্ভিস চার্জ কর্তন ও ক্রেডিট ফেরত পরিচালনা করে। এই নিয়মগুলো প্ল্যাটফর্মের নিয়ম ও শর্তাবলী এবং সাপোর্ট থেকে পাঠানো অর্ডার-সংক্রান্ত যে কোনো যোগাযোগের সঙ্গে একত্রে প্রযোজ্য।`,
    sections: [
      {
        title: 'প্রপার্টি অর্ডারের ক্যাশ রিফান্ড',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              'নির্ধারিত সময়ের মধ্যে গ্রাহকের চাহিদামতো উপযুক্ত বাসা খুঁজে দিতে ব্যর্থ হলে রিফান্ড বিবেচনা করা হবে।',
              'প্রসেসিং এবং হাউস সার্চ শুরুর ন্যূনতম খরচ হিসেবে ২০০ টাকা সার্ভিস চার্জ কাটা হতে পারে, যা সাধারণত ফেরতযোগ্য নয়।',
              'বৈধ রিফান্ড অনুরোধ পেলে সিরিয়াল অনুযায়ী ৭২ ঘণ্টার মধ্যে অর্থ ফেরত দেওয়ার চেষ্টা করা হবে, তবে শুক্র-শনিবার ও সরকারি ছুটি এর বাইরে।',
              'অর্ডার সম্পন্ন হওয়ার ২৪ ঘণ্টা পরে অভিযোগ করলে, অথবা মালিকের সঙ্গে যোগাযোগের পর ব্যক্তিগত মতভেদ দেখা দিলে, সাধারণত ক্যাশ রিফান্ড প্রযোজ্য হবে না।',
              'অর্ডার বাতিল করার চূড়ান্ত অধিকার NewTolet সংরক্ষণ করে।',
            ],
          },
        ],
      },
      {
        title: 'ক্রেডিট রিফান্ড',
        level: 3,
        content: [
          {
            type: 'paragraph',
            text:
              'ক্রয়কৃত ক্রেডিটের বিপরীতে নগদ ফেরত দেওয়া হয় না। তবে আনলক করা কোনো প্রপার্টি রিফান্ডযোগ্য প্রমাণিত হলে ব্যবহৃত ক্রেডিট ব্যবহারকারীর অ্যাকাউন্টে ফেরত যোগ করা হতে পারে।',
          },
          {
            type: 'list',
            items: [
              'প্রপার্টি ইতোমধ্যে ভাড়া হয়ে গেলে',
              'ফোন নম্বরে একাধিকবার চেষ্টা করেও যোগাযোগ সম্ভব না হলে',
              'প্রদত্ত লোকেশন ও বাস্তব লোকেশন না মিললে',
              'আনলকের ৭২ ঘণ্টার মধ্যে যথাযথ অভিযোগ দায়ের করা হলে',
            ],
          },
        ],
      },
      {
        title: 'কাস্টমার সাপোর্ট',
        level: 3,
        content: [
          {
            type: 'list',
            items: [
              `ইমেইল: ${supportEmail}`,
              `ফোন: ${supportPhone}`,
              `ঠিকানা: ${supportAddress}`,
            ],
          },
        ],
      },
    ],
  },
}
