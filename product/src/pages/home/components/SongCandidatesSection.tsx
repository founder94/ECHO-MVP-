import { useState } from 'react';
import AnimatedSection from '@/components/AnimatedSection';

const songCandidates = [
  { id: 1, title: 'SONG 01', artist: 'ARTIST' },
  { id: 2, title: 'SONG 02', artist: 'ARTIST' },
  { id: 3, title: 'SONG 03', artist: 'ARTIST' },
  { id: 4, title: 'SONG 04', artist: 'ARTIST' },
  { id: 5, title: 'SONG 05', artist: 'ARTIST' },
];

export default function SongCandidatesSection() {
  const [selectedSong, setSelectedSong] = useState<number | null>(null);

  return (
    <section id="songs" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-8 text-center">
            오늘 같이 들을 노래
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={150}>
          <div className="space-y-2 mb-6">
            {songCandidates.map((song) => {
              const isSelected = selectedSong === song.id;
              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => setSelectedSong(isSelected ? null : song.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? 'border-white/30 bg-white/[0.08]'
                      : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-white/15' : 'bg-white/5'
                  }`}>
                    <i className={`ri-music-line text-sm ${isSelected ? 'text-white' : 'text-white/60'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-white/85'}`}>
                      {song.title}
                    </p>
                    <p className={`text-[11px] font-medium ${isSelected ? 'text-white/60' : 'text-white/50'}`}>
                      {song.artist}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 flex items-center justify-center">
                      <i className="ri-check-line text-white text-sm" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['이 노래로 할게', '다른 노래도 볼래', '내가 직접 고를게', '음악 없이 계속할게'].map((label) => (
              <button
                key={label}
                type="button"
                className="px-3 py-2.5 rounded-xl border border-white/15 text-xs text-white/75 font-medium hover:border-white/30 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}