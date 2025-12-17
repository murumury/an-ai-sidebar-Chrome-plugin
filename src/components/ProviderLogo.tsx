import { Globe } from 'lucide-react';
import { OpenAI, Claude, Gemini, Grok, DeepSeek } from '@lobehub/icons';

interface ProviderLogoProps {
    id: string;
    className?: string;
    size?: number;
}

export const ProviderLogo = ({ id, className, size = 16 }: ProviderLogoProps) => {
    switch (id) {
        case 'openai':
            return <OpenAI size={size} className={className} />;
        case 'anthropic':
            return <Claude.Color size={size} className={className} />;
        case 'google':
            return <Gemini.Color size={size} className={className} />;
        case 'grok':
            return <Grok size={size} className={className} />;
        case 'deepseek':
            return <DeepSeek.Color size={size} className={className} />;
        case 'vivgrid':
            // Custom Vivgrid SVG from assets
            return (
                <svg viewBox="0 0 112 127" width={size} height={size} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g filter="url(#filter0_i_448_15)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M69.8249 6.31827C47.1135 19.0698 19.3707 37.1496 20.9097 51.8557C21.9627 61.9177 31.9367 65.0314 41.5249 68.0246C58.1533 73.2156 73.6215 78.0445 39.3868 118.125L5.33333 98.4642C2.03305 96.5588 0 93.0374 0 89.2266V36.8533C0 33.0425 2.03305 29.5211 5.33333 27.6157L50.6899 1.42906C53.9902 -0.476353 58.0563 -0.476354 61.3566 1.42906L69.8249 6.31827Z" fill="url(#paint0_linear_448_15)" />
                    </g>
                    <g filter="url(#filter1_i_448_15)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M69.8372 6.96094C47.1257 19.7125 19.3829 37.7923 20.9219 52.4983C21.9749 62.5604 31.9489 65.6741 41.5372 68.6673C58.1655 73.8583 73.6338 78.6872 39.3991 118.768L44.887 121.936C47.2056 119.686 49.57 117.419 51.9386 115.148C78.4976 89.6838 105.595 63.7038 74.7378 54.6068C37.3332 43.5796 49.6977 27.8312 76.5933 10.8616L69.8372 6.96094Z" fill="url(#paint1_linear_448_15)" />
                    </g>
                    <g filter="url(#filter2_i_448_15)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M44.8282 121.749L50.6434 125.107C53.9437 127.012 58.0098 127.012 61.3101 125.107L106.667 98.9201C109.967 97.0147 112 93.4934 112 89.6825V37.3092C112 33.4984 109.967 29.9771 106.667 28.0717L76.7027 10.772C47.4946 27.9159 39.3677 44.01 74.679 54.4202C105.536 63.5172 78.4389 89.4972 51.8799 114.961C49.5112 117.232 47.1468 119.499 44.8282 121.749Z" fill="url(#paint2_linear_448_15)" />
                    </g>
                    <defs>
                        <filter id="filter0_i_448_15" x="0" y="0" width="69.825" height="126.125" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="8" />
                            <feGaussianBlur stdDeviation="5" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.474186 0 0 0 0 1 0 0 0 0 0.769745 0 0 0 0.27 0" />
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_448_15" />
                        </filter>
                        <filter id="filter1_i_448_15" x="20.8606" y="6.96094" width="67.6143" height="134.975" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="20" />
                            <feGaussianBlur stdDeviation="10" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.0173133 0 0 0 0 0.212321 0 0 0 0 0.149919 0 0 0 1 0" />
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_448_15" />
                        </filter>
                        <filter id="filter2_i_448_15" x="44.8282" y="10.772" width="67.1718" height="135.764" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="20" />
                            <feGaussianBlur stdDeviation="10" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.857546 0 0 0 0 0.909473 0 0 0 0 0.685539 0 0 0 0.15 0" />
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_448_15" />
                        </filter>
                        <linearGradient id="paint0_linear_448_15" x1="34.9125" y1="0" x2="34.9125" y2="118.125" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#2DF093" />
                            <stop offset="1" stopColor="#004442" />
                        </linearGradient>
                        <linearGradient id="paint1_linear_448_15" x1="54.6677" y1="6.96094" x2="54.6677" y2="121.936" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#054628" />
                            <stop offset="0.9999" stopColor="#072D28" />
                            <stop offset="1" stopColor="#B1B1B1" />
                        </linearGradient>
                        <linearGradient id="paint2_linear_448_15" x1="78.4141" y1="10.772" x2="78.4141" y2="126.536" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FDFFA3" />
                            <stop offset="1" stopColor="#003C40" />
                        </linearGradient>
                    </defs>
                </svg>
            );
        default:
            return <Globe size={size} className={className} />;
    }
};
