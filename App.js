import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, StatusBar, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { VOCABULARY_DB, PHRASES_DB, READINGS_DB } from './data';

const GRAMMAR_TOPICS = [
  { 
    id: '1', 
    title: 'To Be (Am / Is / Are)', 
    content: "İngilizce'de isim cümleleri kurarken (bir durumu veya durumu anlatırken) kullanılır.", 
    examples: ["I am a student. (Ben öğrenciyim)", "He is happy. (O mutlu)", "They are playing. (Onlar oynuyor)"] 
  },
  { 
    id: '2', 
    title: 'Geniş Zaman (Simple Present)', 
    content: "Her zaman yapılan işler, alışkanlıklar veya genel gerçekler için kullanılır. He, She, It (O) öznelerinde fiil genellikle '-s' takısı alır.", 
    examples: ["I play football. (Ben futbol oynarım)", "She plays tennis. (O tenis oynar)", "Water boils at 100 degrees. (Su 100 derecede kaynar)"] 
  },
  { 
    id: '3', 
    title: 'Şimdiki Zaman (Present Continuous)', 
    content: "Şu an, konuşma anında yapılmakta olan eylemler için 'am/is/are + fiil-ing' yapısı kullanılır.", 
    examples: ["I am reading a book. (Şu an kitap okuyorum)", "They are running. (Onlar koşuyorlar)", "He is sleeping now. (O şu an uyuyor)"] 
  },
  { 
    id: '4', 
    title: 'Have got / Has got (Sahip Olmak)', 
    content: "Bir şeye sahip olduğumuzu belirtmek için kullanırız. I/You/We/They için 'have got', He/She/It için 'has got' kullanılır.", 
    examples: ["I have got a car. (Benim bir arabam var)", "She has got blue eyes. (Onun mavi gözleri var)"] 
  }
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [userWords, setUserWords] = useState({});
  const [todayNewWords, setTodayNewWords] = useState([]);
  const [todayReviewWords, setTodayReviewWords] = useState([]);
  const [phraseOfTheDay, setPhraseOfTheDay] = useState(null);
  
  const [xp, setXp] = useState(0);
  
  const [activeModal, setActiveModal] = useState(null); // 'new', 'review', 'phrase', 'grammar', 'game', 'reading'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [activeReadingTopic, setActiveReadingTopic] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState({});

  // Game States
  const [gameList, setGameList] = useState([]);
  const [gameIndex, setGameIndex] = useState(0);
  const [gameScore, setGameScore] = useState(0);

  // Grammar States
  const [activeGrammarTopic, setActiveGrammarTopic] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const addXp = async (amount) => {
    setXp(prev => {
      const newXp = prev + amount;
      AsyncStorage.setItem('userXp', newXp.toString());
      return newXp;
    });
  };

  const loadData = async () => {
    try {
      const storedStreak = await AsyncStorage.getItem('streak');
      const storedXp = await AsyncStorage.getItem('userXp');
      const lastLogin = await AsyncStorage.getItem('lastLogin');
      const storedUserWords = await AsyncStorage.getItem('userWords');
      
      if (storedXp) setXp(parseInt(storedXp));
      
      const today = new Date().toISOString().split('T')[0];
      let currentStreak = storedStreak ? parseInt(storedStreak) : 0;
      
      if (lastLogin) {
        const lastDate = new Date(lastLogin);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastLogin !== today && lastLogin !== yesterdayStr) {
          currentStreak = 0;
        } else if (lastLogin === yesterdayStr) {
          currentStreak += 1;
        }
      } else {
        currentStreak = 1;
      }
      
      await AsyncStorage.setItem('streak', currentStreak.toString());
      await AsyncStorage.setItem('lastLogin', today);
      setStreak(currentStreak);

      let wordsObj = storedUserWords ? JSON.parse(storedUserWords) : {};
      let toReview = [];
      let knownIds = Object.keys(wordsObj);
      
      knownIds.forEach(id => {
        const wordData = wordsObj[id];
        if (new Date(wordData.nextReviewDate) <= new Date(today)) {
          toReview.push(VOCABULARY_DB.find(w => w.id === id));
        }
      });
      
      let unknownWords = VOCABULARY_DB.filter(w => !knownIds.includes(w.id));
      let newWords = unknownWords.sort(() => 0.5 - Math.random()).slice(0, 5);

      setTodayReviewWords(toReview.filter(w => w !== undefined));
      setTodayNewWords(newWords);
      setUserWords(wordsObj);
      
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      setPhraseOfTheDay(PHRASES_DB[dayIndex % PHRASES_DB.length]);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleWordResult = async (wordId, isCorrect) => {
    let wordData = userWords[wordId] || { interval: 0, repetitions: 0 };
    const today = new Date();
    
    if (isCorrect) {
      wordData.repetitions += 1;
      if (wordData.repetitions === 1) wordData.interval = 1;
      else if (wordData.repetitions === 2) wordData.interval = 3;
      else wordData.interval = Math.round(wordData.interval * 2);
      addXp(10);
    } else {
      wordData.repetitions = 0;
      wordData.interval = 0;
    }
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + wordData.interval);
    wordData.nextReviewDate = nextDate.toISOString().split('T')[0];
    
    const newObj = { ...userWords, [wordId]: wordData };
    setUserWords(newObj);
    await AsyncStorage.setItem('userWords', JSON.stringify(newObj));
  };

  const speakText = (text, rate = 0.9) => {
    Speech.speak(text, { language: 'en-US', rate });
  };

  const startGame = () => {
    // Mixed Practice: 10 random questions
    let shuffledWords = [...VOCABULARY_DB].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    let gameData = shuffledWords.map(w => {
      let qType = Math.floor(Math.random() * 3); // 0: Spelling, 1: EN->TR, 2: TR->EN
      
      if (qType === 0) {
        let wordEn = w.en.toUpperCase();
        let hideIdx = Math.floor(Math.random() * wordEn.length);
        let missingChar = wordEn[hideIdx];
        let masked = wordEn.substring(0, hideIdx) + '_' + wordEn.substring(hideIdx + 1);
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let wrongLetters = [];
        while(wrongLetters.length < 3) {
          let rChar = alphabet[Math.floor(Math.random() * alphabet.length)];
          if(rChar !== missingChar && !wrongLetters.includes(rChar)) wrongLetters.push(rChar);
        }
        let options = [missingChar, ...wrongLetters].sort(() => 0.5 - Math.random());
        return { ...w, type: 'spelling', questionText: "Eksik Harfi Bul", masked, missingChar, options, answer: missingChar };
      } 
      else if (qType === 1) {
        let wrongOptions = VOCABULARY_DB.filter(x => x.id !== w.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.tr);
        let options = [w.tr, ...wrongOptions].sort(() => 0.5 - Math.random());
        return { ...w, type: 'en_tr', questionText: "Bu kelimenin anlamı nedir?", wordToShow: w.en, options, answer: w.tr };
      }
      else {
        let wrongOptions = VOCABULARY_DB.filter(x => x.id !== w.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.en);
        let options = [w.en, ...wrongOptions].sort(() => 0.5 - Math.random());
        return { ...w, type: 'tr_en', questionText: "İngilizcesi nedir?", wordToShow: w.tr, options, answer: w.en };
      }
    });
    
    setGameList(gameData);
    setGameIndex(0);
    setGameScore(0);
    setActiveModal('game');
  };

  const handleGameAnswer = (selectedOption) => {
    const current = gameList[gameIndex];
    if (selectedOption === current.answer) {
      setGameScore(prev => prev + 10);
      addXp(15);
      
      Speech.speak("Bravo! Perfect!", { language: 'en-US', rate: 1.1, pitch: 1.2 });
      
      setTimeout(() => {
        if (gameIndex < gameList.length - 1) {
          setGameIndex(gameIndex + 1);
        } else {
          Alert.alert("Pratik Bitti!", `Toplam Puanın: ${gameScore + 10} / 100`, [
            { text: "Harika!", onPress: () => setActiveModal(null) }
          ]);
        }
      }, 1000);

    } else {
      Speech.speak("Try again!", { language: 'en-US', pitch: 0.8 });
    }
  };

  const unlockBonusWords = () => {
    if (xp < 50) {
      Alert.alert("Yetersiz XP 😢", "Ekstra kelime kilidini açmak için 50 XP'ye ihtiyacın var. Karışık Pratik yaparak biraz XP topla!");
      return;
    }
    
    // Pick 5 unknown words
    let knownIds = Object.keys(userWords);
    let unknownWords = VOCABULARY_DB.filter(w => !knownIds.includes(w.id));
    
    if (unknownWords.length === 0) {
      Alert.alert("Tebrikler! 🎉", "Oyundaki tüm kelimeleri öğrendin! Daha fazla kelime eklenene kadar bekle.");
      return;
    }
    
    addXp(-50);
    let bonusWords = unknownWords.sort(() => 0.5 - Math.random()).slice(0, 5);
    setTodayNewWords(bonusWords);
    Alert.alert("Kilidi Açtın! 🔓", "5 yeni kelime paketi eklendi. Öğrenmeye devam!");
  };

  const renderDashboard = () => (
    <ScrollView style={styles.dashboard} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: '#58CC02', letterSpacing: -1, fontFamily: 'monospace' }]}>acarlingo 🦉</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={[styles.streakBadge, { backgroundColor: '#2C5282', borderColor: '#2B6CB0', marginRight: 10 }]}>
            <Ionicons name="star" size={20} color="#F6E05E" />
            <Text style={[styles.streakText, { color: '#F6E05E' }]}>{xp}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={20} color="#FF9800" />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.taskCard, { backgroundColor: '#58CC02', borderColor: '#46A302', borderWidth: 3, marginBottom: 25, paddingVertical: 25 }]} 
        onPress={startGame}
      >
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🎮</Text>
          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold', letterSpacing: 1 }}>KARIŞIK PRATİK</Text>
          <Text style={{ color: '#E6F4FE', fontSize: 16, marginTop: 5 }}>Öğrendiklerini test et!</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Bugünün Görevleri</Text>
      
      <TouchableOpacity 
        style={[styles.taskCard, todayNewWords.length === 0 && { borderColor: '#F6E05E', borderWidth: 2 }]} 
        onPress={() => {
          if(todayNewWords.length > 0) {
            setActiveModal('new');
            setCurrentIndex(0);
            setShowTranslation(false);
          } else {
            Alert.alert(
              "Ekstra Kelime Paketi 📦",
              "50 XP harcayarak bugün için ekstra 5 yeni kelime kilidini açmak ister misin?",
              [
                { text: "Vazgeç", style: "cancel" },
                { 
                  text: "Aç (-50 XP)", 
                  onPress: () => unlockBonusWords()
                }
              ]
            );
          }
        }}
      >
        <View style={styles.taskIconBox}><Text style={styles.taskIcon}>{todayNewWords.length > 0 ? "✨" : "💎"}</Text></View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>{todayNewWords.length > 0 ? "Yeni Kelimeler Öğren" : "Ekstra Kelime Aç (-50 XP)"}</Text>
          <Text style={styles.taskSub}>{todayNewWords.length > 0 ? `Bugün ${todayNewWords.length} yeni kelime var!` : "XP harca, limite meydan oku!"}</Text>
        </View>
        <Ionicons name={todayNewWords.length > 0 ? "chevron-forward" : "lock-open"} size={24} color={todayNewWords.length > 0 ? "#CCC" : "#F6E05E"} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.taskCard, todayReviewWords.length === 0 && styles.taskCardDone]} 
        onPress={() => {
          if(todayReviewWords.length > 0) {
            setActiveModal('review');
            setCurrentIndex(0);
            setShowTranslation(false);
          }
        }}
      >
        <View style={styles.taskIconBox}><Text style={styles.taskIcon}>🧠</Text></View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>Aralıklı Tekrar Yap</Text>
          <Text style={styles.taskSub}>{todayReviewWords.length} kelime seni bekliyor</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#CCC" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.taskCard} 
        onPress={() => setActiveModal('phrase')}
      >
        <View style={styles.taskIconBox}><Text style={styles.taskIcon}>💬</Text></View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>Günün Konuşma Kalıbı</Text>
          <Text style={styles.taskSub}>Pratik yap ve konuş!</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#CCC" />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Ekstra Pratik</Text>



      <TouchableOpacity style={styles.taskCard} onPress={() => {
        setActiveGrammarTopic(null);
        setActiveModal('grammar');
      }}>
        <View style={[styles.taskIconBox, { backgroundColor: '#319795' }]}><Text style={styles.taskIcon}>📚</Text></View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>Gramer Kuralları</Text>
          <Text style={styles.taskSub}>İngilizce dilbilgisi konuları</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#CCC" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.taskCard} onPress={() => {
        setActiveReadingTopic(null);
        setActiveModal('reading');
      }}>
        <View style={[styles.taskIconBox, { backgroundColor: '#DD6B20' }]}><Text style={styles.taskIcon}>📖</Text></View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>Okuma Parçaları</Text>
          <Text style={styles.taskSub}>İngilizce okuma pratiği yap</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#CCC" />
      </TouchableOpacity>
      <TouchableOpacity 
        style={{ alignItems: 'center', marginTop: 40 }} 
        onPress={() => {
          Alert.alert(
            "UYARI",
            "Tüm veriler (XP, Seri, Kelimeler) sıfırlanacak. Onaylıyor musunuz? (Y/N)",
            [
              { text: "Hayır (N)", style: "cancel" },
              { 
                text: "Evet (Y)", 
                style: "destructive",
                onPress: async () => {
                  await AsyncStorage.clear();
                  setStreak(0);
                  setXp(0);
                  setUserWords({});
                  loadData();
                } 
              }
            ]
          );
        }}
      >
        <Text style={{ color: '#E53E3E', fontSize: 14, textDecorationLine: 'underline', fontWeight: 'bold' }}>İlerlemeyi Sıfırla (Reset)</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 50 }}>
        <Text style={{ color: '#4A5568', fontSize: 16, fontStyle: 'italic', fontWeight: 'bold' }}>made by acarsoft</Text>
      </View>
    </ScrollView>
  );

  const renderStudyModal = () => {
    const isNew = activeModal === 'new';
    const list = isNew ? todayNewWords : todayReviewWords;
    const currentWord = list[currentIndex];

    if (!currentWord) return null;

    const handleNext = (correct) => {
      handleWordResult(currentWord.id, correct);
      if (currentIndex < list.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowTranslation(false);
      } else {
        setActiveModal(null);
        if (isNew) setTodayNewWords([]);
        else setTodayReviewWords([]);
      }
    };

    return (
      <Modal visible={activeModal === 'new' || activeModal === 'review'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)}><Ionicons name="close" size={32} color="#888" /></TouchableOpacity>
            <Text style={styles.progressText}>{currentIndex + 1} / {list.length}</Text>
          </View>
          
          <View style={styles.flashcardArea}>
            <TouchableOpacity activeOpacity={0.9} style={styles.flashcard} onPress={() => setShowTranslation(true)}>
              <Text style={styles.cardEn}>{currentWord.en}</Text>
              <TouchableOpacity style={styles.speakBtn} onPress={() => speakText(currentWord.en)}>
                <Ionicons name="volume-high" size={28} color="#FFF" />
                <Text style={styles.speakBtnText}>Dinle</Text>
              </TouchableOpacity>
              {showTranslation ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.cardTr}>{currentWord.tr}</Text>
                  {currentWord.examples && currentWord.examples.length > 0 && (
                    <View style={{ marginTop: 25, width: '100%', alignItems: 'center' }}>
                      <Text style={{ color: '#F6E05E', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Examples:</Text>
                      {currentWord.examples.map((ex, i) => (
                        <Text key={i} style={{ color: '#E2E8F0', fontSize: 20, marginBottom: 10, textAlign: 'center', fontStyle: 'italic', fontWeight: '500' }}>"{ex}"</Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.tapToReveal}>Çeviriyi görmek için dokun 👆</Text>
              )}
            </TouchableOpacity>
          </View>

          {showTranslation && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnWrong]} onPress={() => handleNext(false)}>
                <Text style={styles.btnText}>Tekrar Sor ❌</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnCorrect]} onPress={() => handleNext(true)}>
                <Text style={styles.btnText}>Öğrendim ✅</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  const renderPhraseModal = () => {
    if (!phraseOfTheDay) return null;
    return (
      <Modal visible={activeModal === 'phrase'} animationType="fade" transparent={true}>
        <View style={styles.phraseOverlay}>
          <View style={styles.phraseBox}>
            <Text style={styles.phraseTitle}>Günün Kalıbı 💬</Text>
            <Text style={styles.phraseEn}>"{phraseOfTheDay.en}"</Text>
            <TouchableOpacity style={[styles.speakBtn, { marginBottom: 25 }]} onPress={() => speakText(phraseOfTheDay.en)}>
              <Ionicons name="volume-high" size={24} color="#FFF" />
              <Text style={styles.speakBtnText}>Sesli Dinle</Text>
            </TouchableOpacity>
            <Text style={styles.phraseTr}>{phraseOfTheDay.tr}</Text>
            <TouchableOpacity style={styles.phraseBtn} onPress={() => setActiveModal(null)}>
              <Text style={styles.phraseBtnText}>Harika! Devam Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const renderGameModal = () => {
    if (activeModal !== 'game' || gameList.length === 0) return null;
    const current = gameList[gameIndex];
    
    return (
      <Modal visible={activeModal === 'game'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)}><Ionicons name="close" size={32} color="#888" /></TouchableOpacity>
            <Text style={styles.progressText}>Skor: {gameScore}</Text>
          </View>
          <View style={styles.flashcardArea}>
            <View style={[styles.flashcard, { height: 'auto', paddingVertical: 40 }]}>
              <Text style={{ fontSize: 20, color: '#A0AEC0', marginBottom: 20, textAlign: 'center' }}>{current.questionText}</Text>
              
              {current.type === 'spelling' ? (
                <>
                  <Text style={{ fontSize: 50, fontWeight: '900', color: '#ED8936', letterSpacing: 8, textAlign: 'center' }}>{current.masked}</Text>
                  <Text style={{ fontSize: 22, color: '#68D391', marginTop: 20, textAlign: 'center' }}>Anlamı: {current.tr}</Text>
                </>
              ) : (
                <Text style={{ fontSize: 40, fontWeight: 'bold', color: '#ED8936', textAlign: 'center' }}>{current.wordToShow}</Text>
              )}
              
              <TouchableOpacity style={[styles.speakBtn, { marginTop: 30, alignSelf: 'center' }]} onPress={() => speakText(current.en)}>
                <Ionicons name="volume-high" size={24} color="#FFF" />
                <Text style={styles.speakBtnText}>Dinle</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 }}>
              {current.options.map((opt, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={[styles.letterBtn, current.type !== 'spelling' && { width: '80%', paddingVertical: 15, height: 'auto', borderRadius: 15 }]} 
                  onPress={() => handleGameAnswer(opt)}
                >
                  <Text style={[styles.letterBtnText, current.type !== 'spelling' && { fontSize: 20 }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderGrammarModal = () => {
    return (
      <Modal visible={activeModal === 'grammar'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          {activeGrammarTopic ? (
            // DETAY EKRANI (Konu Anlatımı)
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setActiveGrammarTopic(null)}><Ionicons name="arrow-back" size={32} color="#888" /></TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 22, flex: 1, textAlign: 'center' }]}>{activeGrammarTopic.title}</Text>
                <View style={{ width: 32 }} />
              </View>
              <ScrollView style={{ padding: 20 }}>
                <View style={styles.grammarRule}>
                  <Text style={styles.grammarTitle}>Nasıl Kullanılır?</Text>
                  <Text style={styles.grammarText}>{activeGrammarTopic.content}</Text>
                  
                  <View style={{ marginTop: 20 }}>
                    <Text style={[styles.grammarTitle, { color: '#F6E05E' }]}>Örnekler:</Text>
                    {activeGrammarTopic.examples.map((ex, i) => (
                      <Text key={i} style={styles.grammarExample}>• {ex}</Text>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : (
            // İNDEKS EKRANI (Konu Listesi)
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setActiveModal(null)}><Ionicons name="close" size={32} color="#888" /></TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 24 }]}>Gramer Konuları</Text>
                <View style={{ width: 32 }} />
              </View>
              <ScrollView style={{ padding: 20 }}>
                {GRAMMAR_TOPICS.map(topic => (
                  <TouchableOpacity 
                    key={topic.id} 
                    style={styles.taskCard} 
                    onPress={() => setActiveGrammarTopic(topic)}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#2C5282' }]}><Text style={styles.taskIcon}>📖</Text></View>
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{topic.title}</Text>
                      <Text style={styles.taskSub}>Konuyu İncele</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#CCC" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };
  const renderReadingModal = () => {
    return (
      <Modal visible={activeModal === 'reading'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          {activeReadingTopic ? (
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => { Speech.stop(); setActiveReadingTopic(null); }}><Ionicons name="arrow-back" size={32} color="#888" /></TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 22, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{activeReadingTopic.title}</Text>
                <View style={{ width: 32 }} />
              </View>
              <ScrollView style={{ padding: 20 }}>
                <View style={styles.grammarRule}>
                  <TouchableOpacity style={[styles.speakBtn, { alignSelf: 'flex-start' }]} onPress={() => speakText(activeReadingTopic.en, 0.8)}>
                    <Ionicons name="volume-high" size={24} color="#FFF" />
                    <Text style={styles.speakBtnText}>Metni Sesli Dinle</Text>
                  </TouchableOpacity>
                  <Text style={[styles.grammarText, { fontSize: 20, color: '#FFFFFF' }]}>{activeReadingTopic.en}</Text>
                  <View style={{ height: 1, backgroundColor: '#4A5568', marginVertical: 20 }} />
                  <Text style={[styles.grammarTitle, { color: '#F6E05E', fontSize: 18 }]}>Çeviri:</Text>
                  <Text style={[styles.grammarText, { color: '#A0AEC0', fontStyle: 'italic' }]}>{activeReadingTopic.tr}</Text>

                  {activeReadingTopic.questions && activeReadingTopic.questions.length > 0 && (
                    <View style={{ marginTop: 25 }}>
                      <Text style={[styles.grammarTitle, { color: '#63B3ED', fontSize: 20, marginBottom: 15 }]}>Test Your Understanding!</Text>
                      {activeReadingTopic.questions.map((qObj, qIndex) => (
                        <View key={qIndex} style={{ marginBottom: 25, backgroundColor: '#2D3748', padding: 15, borderRadius: 15 }}>
                          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>{qIndex + 1}. {qObj.q}</Text>
                          {qObj.options.map((opt, optIndex) => {
                            const isAnswered = answeredQuestions[`${activeReadingTopic.id}_${qIndex}`] !== undefined;
                            const isSelected = answeredQuestions[`${activeReadingTopic.id}_${qIndex}`] === optIndex;
                            const isCorrect = qObj.answer === optIndex;
                            let bgColor = '#4A5568';
                            if (isAnswered) {
                              if (isCorrect) bgColor = '#38A169'; // Green if correct
                              else if (isSelected) bgColor = '#E53E3E'; // Red if selected and wrong
                            }
                            return (
                              <TouchableOpacity 
                                key={optIndex} 
                                style={{ backgroundColor: bgColor, padding: 12, borderRadius: 10, marginBottom: 8 }}
                                disabled={isAnswered}
                                onPress={() => {
                                  if (!isAnswered) {
                                    setAnsweredQuestions(prev => ({ ...prev, [`${activeReadingTopic.id}_${qIndex}`]: optIndex }));
                                    if (isCorrect) {
                                      addXp(20);
                                      Speech.speak("Correct!", { language: 'en-US' });
                                    } else {
                                      Speech.speak("Wrong!", { language: 'en-US' });
                                    }
                                  }
                                }}
                              >
                                <Text style={{ color: '#FFF', fontSize: 16 }}>{opt}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ height: 50 }} />
              </ScrollView>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setActiveModal(null)}><Ionicons name="close" size={32} color="#888" /></TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 24 }]}>Okuma Parçaları</Text>
                <View style={{ width: 32 }} />
              </View>
              <ScrollView style={{ padding: 20 }}>
                {READINGS_DB.map(topic => (
                  <TouchableOpacity 
                    key={topic.id} 
                    style={styles.taskCard} 
                    onPress={() => setActiveReadingTopic(topic)}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: '#DD6B20' }]}><Text style={styles.taskIcon}>📄</Text></View>
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{topic.title}</Text>
                      <Text style={styles.taskSub}>Metni Oku & Dinle</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#CCC" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#4CAF50" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      {renderDashboard()}
      {renderStudyModal()}
      {renderPhraseModal()}
      {renderGameModal()}
      {renderGrammarModal()}
      {renderReadingModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131F24' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#131F24' },
  dashboard: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, marginTop: 15 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#202F36', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  streakText: { fontSize: 20, fontWeight: 'bold', color: '#FF9800', marginLeft: 6 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#A0AEC0', marginBottom: 20 },
  
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#202F36', padding: 22, borderRadius: 18, marginBottom: 18, borderWidth: 1, borderColor: '#2D3748' },
  taskCardDone: { opacity: 0.5 },
  taskIconBox: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#2D3748', justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  taskIcon: { fontSize: 28 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  taskSub: { fontSize: 16, color: '#A0AEC0' },

  modalContainer: { flex: 1, backgroundColor: '#131F24' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25 },
  progressText: { fontSize: 22, fontWeight: 'bold', color: '#A0AEC0' },
  
  flashcardArea: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  flashcard: { width: '100%', height: 420, backgroundColor: '#202F36', borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', padding: 30 },
  cardEn: { fontSize: 50, fontWeight: '900', color: '#63B3ED', textAlign: 'center', marginBottom: 15 },
  
  speakBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A5568', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 25 },
  speakBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },

  cardTr: { fontSize: 36, fontWeight: 'bold', color: '#68D391', textAlign: 'center' },
  tapToReveal: { fontSize: 18, color: '#718096', marginTop: 30, fontWeight: 'bold' },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingBottom: 50 },
  btn: { flex: 1, padding: 22, borderRadius: 18, alignItems: 'center', marginHorizontal: 10 },
  btnWrong: { backgroundColor: '#E53E3E' },
  btnCorrect: { backgroundColor: '#38A169' },
  btnText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  phraseOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  phraseBox: { width: '100%', backgroundColor: '#202F36', borderRadius: 28, padding: 35, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  phraseTitle: { fontSize: 24, fontWeight: 'bold', color: '#ED8936', marginBottom: 25 },
  phraseEn: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 15 },
  phraseTr: { fontSize: 22, color: '#A0AEC0', textAlign: 'center', marginBottom: 35 },
  phraseBtn: { backgroundColor: '#3182CE', width: '100%', padding: 18, borderRadius: 16, alignItems: 'center' },
  phraseBtnText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  // Game UI
  letterBtn: { backgroundColor: '#2D3748', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', margin: 10, borderWidth: 2, borderColor: '#4A5568' },
  letterBtnText: { fontSize: 30, fontWeight: 'bold', color: '#FFF' },

  // Grammar UI
  grammarRule: { backgroundColor: '#202F36', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  grammarTitle: { fontSize: 24, fontWeight: 'bold', color: '#63B3ED', marginBottom: 15 },
  grammarText: { fontSize: 18, color: '#E2E8F0', marginBottom: 15, lineHeight: 28 },
  grammarExample: { fontSize: 18, color: '#68D391', fontStyle: 'italic', marginBottom: 10, lineHeight: 26 }
});
