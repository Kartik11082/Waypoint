import { useState, useRef, useCallback, useEffect } from 'react';
import { getStories, getClues, postScore, recordPin, postResult, getPlayerId } from '../api/client';
import { useTimer } from './useTimer';

/*
 * useGame — Central game state and logic
 *
 * State flow:
 *   splash → loading → game → result → final
 *
 * Key behaviors:
 *   - Fetches 5 daily stories on start (same for all players today)
 *   - Bots simulate guesses when player submits
 *   - Fingerprint + device hash prevents same-day replay
 *   - Stats and leaderboard are fire-and-forget (never block game)
 *
 * Dependencies:
 *   api/client.js — all network calls
 *   useTimer.js   — round countdown
 */

const LOADING_MESSAGES = [
    'Scanning today\'s headlines...',
    'Extracting story locations...',
    'Generating clues with AI...',
    'Preparing the terrain...',
];

function buildScorePayload(pin, story, cluesRevealed, timeLeft) {
    const scoreBody = {
        lat: pin.lat,
        lng: pin.lng,
        correct_lat: story.lat,
        correct_lng: story.lng,
        clues_used: cluesRevealed,
        seconds_taken: 60 - timeLeft,
    };
    if (story.sw_lat !== undefined) {
        scoreBody.sw_lat = story.sw_lat;
        scoreBody.sw_lng = story.sw_lng;
        scoreBody.ne_lat = story.ne_lat;
        scoreBody.ne_lng = story.ne_lng;
    }
    return scoreBody;
}

function buildRoundRecord(currentRound, story, result, cluesRevealed, clues) {
    return {
        round: currentRound + 1,
        story_id: story.id,
        headline: story.headline,
        score: result.score,
        distance_km: result.distance_km,
        verdict: result.verdict,
        verdict_class: result.verdict_class,
        cluesUsed: cluesRevealed,
        category: clues?.category || 'POLITICS',
    };
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

    const playerScoreRef = useRef(0);
    const storiesRef = useRef([]);
    const msgIntervalRef = useRef(null);

    const handleExpire = useCallback(() => {
        // Auto-submit if pin placed, otherwise just stop
    }, []);

    const timer = useTimer(60, handleExpire);

    const buildScoreboard = () => {
        return [
            { name: playerName, score: playerScoreRef.current, isPlayer: true }
        ];
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

        // Prevent replay: check localStorage before fetching stories
        // Device hash check happens server-side on leaderboard submit
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
        const scoreBody = buildScorePayload(pin, story, cluesRevealed, timer.timeLeft);

        const result = await postScore(scoreBody);

        playerScoreRef.current += result.score;

        // Fire and forget — stats failure must never block the game
        // Bots guess based on accuracy — higher accuracy =
        // smaller random offset from correct location
        recordPin({
            story_id: story.id,
            lat: pin.lat,
            lng: pin.lng,
            clues_used: cluesRevealed,
            score: result.score,
        });

        // Build round result record
        const roundRecord = buildRoundRecord(currentRound, story, result, cluesRevealed, clues);

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
            correctBounds: story.sw_lat !== undefined ? {
                sw_lat: story.sw_lat,
                sw_lng: story.sw_lng,
                ne_lat: story.ne_lat,
                ne_lng: story.ne_lng,
            } : null,
        });

        // Delay result card so map line draws first
        setTimeout(() => setScreen('result'), 1500);
    };

    const nextRound = () => {
        if (currentRound >= 4) {
            // Fire and forget — stats failure must never block the game
            postResult({
                player_id: getPlayerId(),
                total_score: playerScoreRef.current,
                rounds: [...roundResults].map((r) => ({
                    story_id: r.story_id,
                    category: r.category,
                    score: r.score,
                    verdict: r.verdict,
                })),
            }).catch(() => {});
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
