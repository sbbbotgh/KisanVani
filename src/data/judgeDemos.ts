import type { JudgeDemo } from '../types'

export const JUDGE_DEMOS: JudgeDemo[] = [
  {
    id: 'demo-hinglish',
    dialect: 'Hinglish',
    label: 'Hinglish · Rain risk → Sell',
    displayTranscript: 'Bhaiya, Ludhiana mein wheat ka kya rate hai aur kal heavy rain ka chance hai kya?',
    crop: 'wheat',
    district: 'Ludhiana',
    expectedDecision: 'SELL TODAY',
  },
  {
    id: 'demo-punjlish',
    dialect: 'Punjlish',
    label: 'Punjlish · Better nearby price → Transport',
    displayTranscript: 'Bapu ji kehnde ne Khanna mandi ch kanak da rate Ludhiana naalon better hai, kivein karan?',
    crop: 'wheat',
    district: 'Ludhiana',
    expectedDecision: 'TRANSPORT TO NEARBY MANDI',
  },
  {
    id: 'demo-tanglish',
    dialect: 'Tanglish',
    label: 'Tanglish · Dry forecast → Hold',
    displayTranscript: 'Anna, Thanjavur mandi la paddy price check pannunga. Next 3 days dry weather ah?',
    crop: 'rice',
    district: 'Thanjavur',
    expectedDecision: 'HOLD FOR 2 DAYS',
  },
]
