import {it,expect} from 'vitest';
import {parseWonInput,validEntryDate} from './entry-input';
import {todayKST} from './golf';
it('금액 입력에서 쉼표와 통화 표시를 허용한다',()=>{expect(parseWonInput('100,000')).toBe(100000);expect(parseWonInput('₩ 10,000원')).toBe(10000);});
it('비정상 금액은 저장하지 않는다',()=>{for(const s of ['', '-100', '1.5','1만원','0','100000001'])expect(parseWonInput(s)).toBeNull();});
it('날짜 입력에 사용할 ISO 날짜만 허용한다',()=>{expect(validEntryDate('2026-10-30')).toBe(true);expect(validEntryDate('2026-02-30')).toBe(false);expect(validEntryDate('10/30/2026')).toBe(false);expect(todayKST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);});
