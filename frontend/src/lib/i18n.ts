import type { AppLanguage } from '../store/languageStore';

type I18nKey =
  | 'nav_home'
  | 'nav_payouts'
  | 'nav_copilot'
  | 'nav_profile'
  | 'select_language'
  | 'applies_entire_app'
  | 'zone'
  | 'ai_assistant_online'
  | 'ask_coverage'
  | 'loading_dashboard'
  | 'initializing'
  | 'redirecting_login'
  | 'profile_title'
  | 'verified_member'
  | 'active_coverage'
  | 'how_it_works'
  | 'tier_decision_factors'
  | 'trust_score'
  | 'documents'
  | 'account_settings'
  | 'download_tier_policy'
  | 'update_earnings_declaration'
  | 'notification_preferences'
  | 'sign_out'
  | 'payouts_title'
  | 'claim_settlements'
  | 'recent_claims'
  | 'no_payouts_yet'
  | 'no_payouts_desc';

const dictionary: Record<AppLanguage, Partial<Record<I18nKey, string>>> = {
  en: {
    nav_home: 'Home',
    nav_payouts: 'Payouts',
    nav_copilot: 'Copilot',
    nav_profile: 'Profile',
    select_language: 'Select Language',
    applies_entire_app: 'Applies across the worker app',
    zone: 'Zone',
    ai_assistant_online: 'AI Assistant Online',
    ask_coverage: 'Ask anything about your coverage...',
    loading_dashboard: 'Loading Dashboard...',
    initializing: 'Initializing...',
    redirecting_login: 'Redirecting to login...',
    profile_title: 'Profile',
    verified_member: 'Verified Member',
    active_coverage: 'gigHood Protect: Active Coverage',
    how_it_works: 'How it Works',
    tier_decision_factors: 'Tier Decision Factors',
    trust_score: 'Trust Score',
    documents: 'Documents',
    account_settings: 'Account Settings',
    download_tier_policy: 'Download Tier Policy Certificate',
    update_earnings_declaration: 'Update Earnings Declaration',
    notification_preferences: 'Notification Preferences',
    sign_out: 'Sign Out',
    payouts_title: 'Payouts',
    claim_settlements: 'Your claim settlements',
    recent_claims: 'Recent Claims',
    no_payouts_yet: 'No payouts yet',
    no_payouts_desc: 'When a disruption hits your zone, gigHood pays you automatically. No action needed.',
  },
  hi: {
    nav_home: 'होम',
    nav_payouts: 'भुगतान',
    nav_copilot: 'कॉपायलट',
    nav_profile: 'प्रोफाइल',
    select_language: 'भाषा चुनें',
    applies_entire_app: 'पूरे वर्कर ऐप पर लागू',
    zone: 'ज़ोन',
    ai_assistant_online: 'एआई सहायक ऑनलाइन',
    ask_coverage: 'अपनी कवरेज के बारे में पूछें...',
    loading_dashboard: 'डैशबोर्ड लोड हो रहा है...',
    initializing: 'शुरू किया जा रहा है...',
    redirecting_login: 'लॉगिन पर भेजा जा रहा है...',
  },
  ta: {
    nav_home: 'முகப்பு',
    nav_payouts: 'பணம்',
    nav_copilot: 'கோபைலட்',
    nav_profile: 'சுயவிவரம்',
    select_language: 'மொழியை தேர்வு செய்யவும்',
    applies_entire_app: 'முழு வொர்கர் செயலியில் பொருந்தும்',
    zone: 'பகுதி',
    ai_assistant_online: 'ஏஐ உதவியாளர் ஆன்லைன்',
    ask_coverage: 'உங்கள் கவரேஜ் பற்றி கேளுங்கள்...',
    loading_dashboard: 'டாஷ்போர்ட் ஏற்றப்படுகிறது...',
    initializing: 'தொடங்குகிறது...',
    redirecting_login: 'உள்நுழைவிற்கு மாற்றப்படுகிறது...',
    profile_title: 'சுயவிவரம்',
    verified_member: 'சரிபார்க்கப்பட்ட உறுப்பினர்',
    active_coverage: 'gigHood Protect: செயலில் உள்ள கவரேஜ்',
    how_it_works: 'இது எப்படி செயல்படுகிறது',
    tier_decision_factors: 'டையர் முடிவு காரணங்கள்',
    trust_score: 'நம்பிக்கை மதிப்பெண்',
    documents: 'ஆவணங்கள்',
    account_settings: 'கணக்கு அமைப்புகள்',
    download_tier_policy: 'டையர் பாலிசி சான்றை பதிவிறக்கவும்',
    update_earnings_declaration: 'வருமான அறிவிப்பை புதுப்பிக்கவும்',
    notification_preferences: 'அறிவிப்பு விருப்பங்கள்',
    sign_out: 'வெளியேறு',
    payouts_title: 'பணம்',
    claim_settlements: 'உங்கள் க்ளைம் முடிவுகள்',
    recent_claims: 'சமீபத்திய க்ளைம்கள்',
    no_payouts_yet: 'இன்னும் பணம் இல்லை',
    no_payouts_desc: 'உங்கள் மண்டலத்தில் இடையூறு ஏற்பட்டால், gigHood தானாக பணம் வழங்கும்.',
  },
  te: {
    nav_home: 'హోమ్',
    nav_payouts: 'చెల్లింపులు',
    nav_copilot: 'కోపైలట్',
    nav_profile: 'ప్రొఫైల్',
    select_language: 'భాషను ఎంచుకోండి',
    applies_entire_app: 'మొత్తం వర్కర్ యాప్‌కు వర్తిస్తుంది',
    zone: 'జోన్',
    ai_assistant_online: 'ఏఐ సహాయకుడు ఆన్‌లైన్',
    ask_coverage: 'మీ కవరేజ్ గురించి ఏదైనా అడగండి...',
    loading_dashboard: 'డాష్‌బోర్డ్ లోడవుతోంది...',
    initializing: 'ప్రారంభిస్తోంది...',
    redirecting_login: 'లాగిన్‌కు మార్చుతోంది...',
  },
  kn: {
    nav_home: 'ಮುಖಪುಟ',
    nav_payouts: 'ಪಾವತಿಗಳು',
    nav_copilot: 'ಕೋಪೈಲಟ್',
    nav_profile: 'ಪ್ರೊಫೈಲ್',
    select_language: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    applies_entire_app: 'ಪೂರ್ಣ ವರ್ಕರ್ ಆಪ್‌ಗೆ ಅನ್ವಯಿಸುತ್ತದೆ',
    zone: 'ಝೋನ್',
    ai_assistant_online: 'ಎಐ ಸಹಾಯಕ ಆನ್‌ಲೈನ್',
    ask_coverage: 'ನಿಮ್ಮ ಕವರ್ ಬಗ್ಗೆ ಏನಾದರೂ ಕೇಳಿ...',
    loading_dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    initializing: 'ಆರಂಭವಾಗುತ್ತಿದೆ...',
    redirecting_login: 'ಲಾಗಿನ್‌ಗೆ ರೀಡೈರೆಕ್ಟ್ ಆಗುತ್ತಿದೆ...',
    profile_title: 'ಪ್ರೊಫೈಲ್',
    verified_member: 'ಪರಿಶೀಲಿತ ಸದಸ್ಯ',
    active_coverage: 'gigHood Protect: ಸಕ್ರಿಯ ಕವರೆಜ್',
    how_it_works: 'ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
    tier_decision_factors: 'ಟಿಯರ್ ನಿರ್ಧಾರ ಕಾರಣಗಳು',
    trust_score: 'ನಂಬಿಕೆ ಅಂಕ',
    documents: 'ದಾಖಲೆಗಳು',
    account_settings: 'ಖಾತೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    download_tier_policy: 'ಟಿಯರ್ ಪಾಲಿಸಿ ಪ್ರಮಾಣಪತ್ರ ಡೌನ್‌ಲೋಡ್',
    update_earnings_declaration: 'ಆದಾಯ ಘೋಷಣೆಯನ್ನು ನವೀಕರಿಸಿ',
    notification_preferences: 'ಅಧಿಸೂಚನೆ ಆದ್ಯತೆಗಳು',
    sign_out: 'ಸೈನ್ ಔಟ್',
    payouts_title: 'ಪಾವತಿಗಳು',
    claim_settlements: 'ನಿಮ್ಮ ಕ್ಲೈಮ್ ನಿವಾರಣೆಗಳು',
    recent_claims: 'ಇತ್ತೀಚಿನ ಕ್ಲೈಮ್‌ಗಳು',
    no_payouts_yet: 'ಇನ್ನೂ ಪಾವತಿ ಇಲ್ಲ',
    no_payouts_desc: 'ನಿಮ್ಮ ಝೋನ್‌ನಲ್ಲಿ ವ್ಯತ್ಯಯ ಬಂದಾಗ gigHood ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪಾವತಿಸುತ್ತದೆ.',
  },
  mr: {
    nav_home: 'मुख्यपृष्ठ',
    nav_payouts: 'पेमेंट्स',
    nav_copilot: 'कोपायलट',
    nav_profile: 'प्रोफाइल',
    select_language: 'भाषा निवडा',
    applies_entire_app: 'संपूर्ण वर्कर अॅपमध्ये लागू',
    zone: 'झोन',
    ai_assistant_online: 'एआय सहाय्यक ऑनलाइन',
    ask_coverage: 'तुमच्या कव्हरेजबद्दल काहीही विचारा...',
    loading_dashboard: 'डॅशबोर्ड लोड होत आहे...',
    initializing: 'सुरू होत आहे...',
    redirecting_login: 'लॉगिनकडे वळवित आहे...',
  },
  bn: {
    nav_home: 'হোম',
    nav_payouts: 'পেআউট',
    nav_copilot: 'কোপাইলট',
    nav_profile: 'প্রোফাইল',
    select_language: 'ভাষা বেছে নিন',
    applies_entire_app: 'পুরো ওয়ার্কার অ্যাপে প্রযোজ্য',
    zone: 'জোন',
    ai_assistant_online: 'এআই সহকারী অনলাইন',
    ask_coverage: 'আপনার কভারেজ সম্পর্কে জিজ্ঞাসা করুন...',
    loading_dashboard: 'ড্যাশবোর্ড লোড হচ্ছে...',
    initializing: 'শুরু হচ্ছে...',
    redirecting_login: 'লগইনে পাঠানো হচ্ছে...',
  },
  as: {
    nav_home: 'হোম',
    nav_payouts: 'পেমেণ্ট',
    nav_copilot: 'কোপাইলট',
    nav_profile: 'প্ৰ' + 'ফাইল',
    select_language: 'ভাষা বাছনি কৰক',
    applies_entire_app: 'সম্পূৰ্ণ ৱৰ্কাৰ এপত প্ৰযোজ্য',
    zone: 'জ' + 'োন',
    ai_assistant_online: 'এআই সহায়ক অনলাইন',
    ask_coverage: 'আপোনাৰ কভাৰেজ বিষয়ে সুধক...',
    loading_dashboard: 'ডেশ্বব' + 'ৰ্ড লোড হৈ আছে...',
    initializing: 'আৰম্ভ হৈ আছে...',
    redirecting_login: 'লগইনলৈ পঠিয়াই আছে...',
  },
};

export function t(language: AppLanguage, key: I18nKey): string {
  return dictionary[language]?.[key] || dictionary.en[key] || key;
}
