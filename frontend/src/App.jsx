import { Component } from 'react';
import Splash from './screens/Splash';
import Loading from './screens/Loading';
import Game from './screens/Game';
import Result from './screens/Result';
import Final from './screens/Final';
import { useGame } from './hooks/useGame';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="screen">
                    <span
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '48px',
                            color: 'var(--primary)',
                            marginBottom: 'var(--s4)',
                        }}
                    >
                        SIGNAL LOST
                    </span>
                    <p
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '12px',
                            color: 'var(--muted)',
                            marginBottom: 'var(--s5)',
                        }}
                    >
                        Something went wrong. Reload to try again.
                    </p>
                    <button className="btn-primary" onClick={() => window.location.reload()}>
                        RELOAD
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function AppInner() {
    const game = useGame();
    const showGame = game.screen === 'game' || game.screen === 'result';

    return (
        <>
            {game.screen === 'splash' && (
                <Splash onStart={game.startGame} />
            )}

            {game.screen === 'loading' && (
                <Loading message={game.loadingMessage} />
            )}

            {/* Game stays mounted during result screen so map persists */}
            {showGame && (
                <Game
                    story={game.currentStory}
                    clues={game.clues}
                    cluesRevealed={game.cluesRevealed}
                    onRevealClue={game.revealClue}
                    pin={game.pin}
                    onPinPlace={game.placePin}
                    onSubmit={game.submitGuess}
                    timeLeft={game.timeLeft}
                    roundNumber={game.currentRound + 1}
                    scores={game.scores}
                    submitted={game.submitted}
                />
            )}

            {game.screen === 'result' && (
                <Result
                    result={game.roundResult}
                    story={game.currentStory}
                    cluesUsed={game.cluesRevealed}
                    pin={game.pin}
                    scores={game.scores}
                    roundNumber={game.currentRound + 1}
                    onNext={game.nextRound}
                />
            )}

            {game.screen === 'final' && (
                <Final
                    playerName={game.playerName}
                    scores={game.scores}
                    roundResults={game.roundResults}
                    onPlayAgain={() => window.location.reload()}
                />
            )}
        </>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppInner />
        </ErrorBoundary>
    );
}
