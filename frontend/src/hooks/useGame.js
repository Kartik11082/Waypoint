import { useState, useRef, useCallback, useEffect } from 'react';
import { getStories, getClues, postScore } from '../api/client';
import { useTimer } from './useTimer';

const BOTS = [
    { name: 'RILEY H.', accuracy: 0.88 },
    { name: 'SASHA M.', accuracy: 0.65 },
    { name: 'ALEX T.', accuracy: 0.45 },
    { name: 'DREW V.', accuracy: 0.72 },
];

const LOADING_MESSAGES = [
    'Scanning today\'s headlines...',
    'Extracting story locations...',
    'Generating clues with AI...',
    'Briefing your competitors...',
];

async function botGuessScore(bot, correctLat, correctLng) {
    const maxOffset = 3000 * (1 - bot.accuracy);
    const dist = maxOffset * (0.3 + Math.random() * 0.7);
    const cluesUsed = bot.accuracy > 0.8 ? 1 : bot.accuracy > 0.6 ? 2 : 3;
    const timeTaken = 10 + Math.random() * 45;

    const result = await postScore({
        lat: correctLat + (Math.random() - 0.5) * (dist / 111),
        lng: correctLng + (Math.random() - 0.5) * (dist / 111),
        correct_lat: correctLat,
        correct_lng: correctLng,
        clues_used: cluesUsed,
        seconds_taken: timeTaken,
    });
    return result.score;
}

export function useGame() {
    const [playerName, setPlayerName] = useState('');
    const [screen, setScreen] = useState('splash');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [stories, setStories] = useState([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [clues, setClues] = useState(null);
    const [cluesRevealed, setCluesRevealed] = useState(1);
    const [pin, setPin] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [roundResult, setRoundResult] = useState(null);
    const [roundResults, setRoundResults] = useState([]);
    const [scores, setScores] = useState([]);

    const botsRef = useRef(BOTS.map((b) => ({ ...b, score: 0, isPlayer: false })));
    const playerScoreRef = useRef(0);
    const storiesRef = useRef([]);
    const msgIntervalRef = useRef(null);

    const handleExpire = useCallback(() => {
        // Auto-submit if pin placed, otherwise just stop
    }, []);

    const timer = useTimer(60, handleExpire);

    const buildScoreboard = () => {
        const all = [
            { name: playerName, score: playerScoreRef.current, isPlayer: true },
            ...botsRef.current.map((b) => ({ name: b.name, score: b.score, isPlayer: false })),
        ];
        all.sort((a, b) => b.score - a.score);
        return all;
    };

    const startRound = async (roundIndex) => {
        setCurrentRound(roundIndex);
        setCluesRevealed(1);
        setPin(null);
        setSubmitted(false);
        setRoundResult(null);
        setClues(null);

        const story = storiesRef.current[roundIndex];
        try {
            const clueData = await getClues(story.id);
            setClues(clueData);
        } catch (e) {
            console.error('Failed to fetch clues:', e);
        }

        setScreen('game');
        timer.start();
    };

    const startGame = async (name) => {
        setPlayerName(name);
        setScreen('loading');
        botsRef.current = BOTS.map((b) => ({ ...b, score: 0, isPlayer: false }));
        playerScoreRef.current = 0;
        setRoundResults([]);
        setScores([]);

        // Cycle loading messages
        let msgIndex = 0;
        setLoadingMessage(LOADING_MESSAGES[0]);
        msgIntervalRef.current = setInterval(() => {
            msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
            setLoadingMessage(LOADING_MESSAGES[msgIndex]);
        }, 2000);

        try {
            const data = await getStories();
            const storyList = (data.stories || data).slice(0, 5);
            setStories(storyList);
            storiesRef.current = storyList;
        } catch (e) {
            console.error('Failed to fetch stories:', e);
        }

        clearInterval(msgIntervalRef.current);
        setLoadingMessage('Ready');

        setTimeout(() => startRound(0), 400);
    };

    const revealClue = () => {
        if (cluesRevealed < 3) setCluesRevealed((c) => c + 1);
    };

    const placePin = (lat, lng) => {
        if (submitted) return;
        setPin({ lat, lng });
    };

    const submitGuess = async () => {
        if (!pin || submitted) return;
        timer.stop();
        setSubmitted(true);

        const story = storiesRef.current[currentRound];

        // Player score
        const result = await postScore({
            lat: pin.lat,
            lng: pin.lng,
            correct_lat: story.lat,
            correct_lng: story.lng,
            clues_used: cluesRevealed,
            seconds_taken: 60 - timer.timeLeft,
        });

        playerScoreRef.current += result.score;

        // Bot scores (concurrent)
        const botScores = await Promise.all(
            botsRef.current.map((bot) => botGuessScore(bot, story.lat, story.lng))
        );

        botsRef.current.forEach((bot, i) => {
            bot.score += botScores[i];
        });

        // Build round result record
        const roundRecord = {
            round: currentRound + 1,
            headline: story.headline,
            score: result.score,
            distance_km: result.distance_km,
            verdict: result.verdict,
            verdict_class: result.verdict_class,
            cluesUsed: cluesRevealed,
        };

        const newRoundResults = [...roundResults, roundRecord];
        setRoundResults(newRoundResults);

        const scoreboard = buildScoreboard();
        setScores(scoreboard);

        setRoundResult({
            score: result.score,
            distanceKm: result.distance_km,
            verdict: result.verdict,
            verdictClass: result.verdict_class,
            breakdown: result.breakdown,
        });

        // Delay result card so map line draws first
        setTimeout(() => setScreen('result'), 1500);
    };

    const nextRound = () => {
        if (currentRound >= 4) {
            setScreen('final');
        } else {
            startRound(currentRound + 1);
        }
    };

    // Keyboard shortcuts
    const screenRef = useRef(screen);
    const pinRef = useRef(pin);
    const submittedRef = useRef(submitted);
    useEffect(() => { screenRef.current = screen; }, [screen]);
    useEffect(() => { pinRef.current = pin; }, [pin]);
    useEffect(() => { submittedRef.current = submitted; }, [submitted]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            const s = screenRef.current;
            if ((e.key === 'r' || e.key === 'R') && s === 'game') revealClue();
            if (e.key === 'Enter' && s === 'game' && pinRef.current && !submittedRef.current) submitGuess();
            if (e.key === 'Escape' && s === 'result') nextRound();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const playAgain = () => {
        setScreen('splash');
        timer.reset();
    };

    return {
        // state
        playerName,
        screen,
        loadingMessage,
        currentRound,
        clues,
        cluesRevealed,
        pin,
        submitted,
        roundResult,
        roundResults,
        scores,
        timeLeft: timer.timeLeft,
        currentStory: stories[currentRound] || null,
        // actions
        startGame,
        revealClue,
        placePin,
        submitGuess,
        nextRound,
        playAgain,
    };
}
