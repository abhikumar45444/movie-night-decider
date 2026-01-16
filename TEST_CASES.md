# Movie Night Decider - Edge Case Testing Plan

## Test Setup
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:5173`
- Open multiple browser windows/tabs for multi-user testing

---

## Test Case 1: Multiple Users Join and Vote Sequentially
**Objective:** Verify participant count updates correctly as users join and vote

**Steps:**
1. User A creates room (show code)
2. User B joins room → Check: Both see 2 participants ✓
3. User A votes YES on movies 1-3
4. User B votes NO on movie 1, YES on movies 2-3
5. Check: Partial results show only movie 2 & 3 as matches

**Expected:** Participant count = 2, Matches = 2

---

## Test Case 2: User Joins Mid-Voting
**Objective:** Verify new user sees correct voting progress

**Steps:**
1. User A creates room, votes on 10 movies
2. User B joins room mid-voting
3. Check: User B sees correct participant count and progress
4. User B continues voting from current position
5. Check: All previous A votes still count

**Expected:** Both users see same progress, no data loss

---

## Test Case 3: User Rejoins After Leaving
**Objective:** Verify vote persistence and state recovery

**Steps:**
1. User A creates room, votes on 5 movies
2. User B joins, votes on 5 movies
3. Participant count = 2, Matches visible
4. User B closes tab/leaves room
5. Check: User A still sees count = 1 ✓
6. User B rejoins with new session
7. Check: Previous votes from User B are preserved or cleared (define behavior)
8. Participant count updates to 2 again

**Expected:** System correctly handles rejoin, no duplicates

---

## Test Case 4: New User Breaks Consensus
**Objective:** Verify matched movies drop from count when consensus breaks

**Steps:**
1. User A votes YES on movies 1-2
2. User B votes YES on movies 1-2
3. Check: "View Matches So Far (2)" ✓
4. User C joins room
5. User C votes NO on movie 1, YES on movie 2
6. Check: Button updates to "View Matches So Far (1)"
7. Click modal: Only movie 2 shown

**Expected:** Count updates immediately, old match removed from list

---

## Test Case 5: Three or More Users Voting
**Objective:** Verify complex consensus with 3+ participants

**Steps:**
1. Create room with Users A, B, C, D (4 total)
2. A: YES, YES, NO, YES on movies 1-4
3. B: YES, YES, YES, NO on movies 1-4
4. C: YES, NO, NO, NO on movies 1-4
5. D: YES, YES, YES, NO on movies 1-4
6. Check: Only movie 1 shows as match (all 4 voted YES)
7. Check: Button shows "View Matches So Far (1)"

**Expected:** Only unanimous votes count

---

## Test Case 6: User Leaves and Room State
**Objective:** Verify room stability when users disconnect

**Steps:**
1. Room has Users A, B, C (3 participants)
2. All voted YES on movie 1
3. Check: Matches = 1 ✓
4. User B closes browser/leaves
5. Check: Participant count drops to 2 (User A sees this)
6. Check: Movie 1 is NO LONGER a match (only 2 out of 3 voted YES)
7. Button shows "View Matches So Far (0)"

**Expected:** Vote requirements adjust to current participant count

---

## Test Case 7: All Users Leave and New Users Join
**Objective:** Verify room resets for new voting session

**Steps:**
1. Users A, B create room, vote on 5 movies
2. Both leave room
3. Room still exists (code valid)
4. Users C, D join same room
5. Check: Previous votes are cleared or new session starts
6. Vote on movies: C votes YES on 1-2, D votes YES on 2-3
7. Check: Only movie 2 is match

**Expected:** New users start fresh or see old data (define cleanup policy)

---

## Test Case 8: WebSocket Reconnection
**Objective:** Verify reconnection doesn't lose state

**Steps:**
1. User A votes on 5 movies
2. User B joins
3. Disconnect B's internet/close WebSocket
4. Wait 5+ seconds
5. Check: B automatically reconnects (after 3-second retry)
6. B continues voting
7. A's votes are still visible to B

**Expected:** Auto-reconnect works, no data loss

---

## Test Case 9: Rapid Voting
**Objective:** Verify no race conditions with fast voting

**Steps:**
1. User A rapidly clicks YES/NO on 10 movies in succession
2. User B joins while A is voting
3. Check: All votes recorded correctly
4. No missing or duplicate votes
5. Participant count doesn't flicker

**Expected:** All votes stored, count accurate

---

## Test Case 10: Matches Display Accuracy
**Objective:** Verify modal shows exactly matching movies

**Steps:**
1. Users A, B vote on 20 movies
2. Movies 3, 7, 15, 19 are unanimous matches
3. Click "View Matches So Far"
4. Check: Modal shows exactly 4 movies
5. Verify titles, ratings, posters correct
6. No extra or missing movies

**Expected:** Only exact matches shown, accurate data

---

## Test Case 11: Room Code Sharing
**Objective:** Verify room code works across multiple browsers

**Steps:**
1. User A creates room, gets code "ABC123"
2. Copy code
3. Open new browser window
4. User B enters code "ABC123"
5. Check: B joins A's room correctly
6. Both see same movie list, participant count

**Expected:** Code works reliably

---

## Test Case 12: Completion Flow
**Objective:** Verify app handles voting completion

**Steps:**
1. Users A, B vote on all 20 movies
2. Both reach voting complete
3. Check: Results page shows final matches
4. Can view all matched movies
5. Option to exit and create new room

**Expected:** Smooth completion, no errors

---

## Bugs to Watch For
- ❌ Participant count doesn't update in real-time
- ❌ Matches showing count ≠ actual matches in modal
- ❌ Votes lost after page refresh
- ❌ User appears twice in participant list
- ❌ Old votes apply to new users
- ❌ WebSocket doesn't reconnect
- ❌ Consensus breaks but match still shows
- ❌ Room code doesn't work for joining
- ❌ Movies show twice or out of order
- ❌ Modal shows wrong movies

---

## Success Criteria
✅ All 12 test cases pass  
✅ No console errors (except DevTools recommendation)  
✅ Participant count always accurate  
✅ Matches always show unanimous votes only  
✅ WebSocket reconnects automatically  
✅ All user interactions are smooth
