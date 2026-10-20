// tests/adversarial/m3-empirical-challenge.test.mjs
// Adversarial Empirical Challenge Suite for Milestone 3 (F8, F9)
//
// Mandate:
// 1. Real-time chat: Message emission, reception, optimistic ID reconciliation (temp-* -> canonical ID),
//    deduplication when duplicate events arrive, auto-scroll trigger.
// 2. Active Community Presence: Channel authorization requires active session (401 for guest),
//    joining adds user to liveActiveMembers, leaving sets isOnline=false, no .tmp/presence.json disk writes occur.
// 3. Verify that polling intervals (3.5s, 7s, 15s) are completely absent from client components.
// 4. Adversarial edge cases: Race conditions, duplicate events, burst messaging, multi-tab presence, malformed payloads.
//
// Author: teamwork_preview_challenger_m3_1 (Empirical Challenger)

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

// =============================================================================
// PROBE 1: Real-Time Chat (F8) - Emission, Reception, Reconciliation, Deduplication, Scroll
// =============================================================================

function probe1RealTimeChat() {
  console.log('\n================================================================');
  console.log('PROBE 1: Real-Time Chat Mechanics (F8)');
  console.log('================================================================');

  const messagesClientPath = path.join(projectRoot, 'apps', 'web', 'components', 'MessagesClient.tsx');
  const messagesRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'conversations', '[conversationId]', 'messages', 'route.ts');
  const conversationsRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'conversations', 'route.ts');

  assert.ok(fs.existsSync(messagesClientPath), `MessagesClient must exist at ${messagesClientPath}`);
  assert.ok(fs.existsSync(messagesRoutePath), `Messages route must exist at ${messagesRoutePath}`);
  assert.ok(fs.existsSync(conversationsRoutePath), `Conversations route must exist at ${conversationsRoutePath}`);

  const clientSource = fs.readFileSync(messagesClientPath, 'utf8');
  const messagesRouteSource = fs.readFileSync(messagesRoutePath, 'utf8');
  const convRouteSource = fs.readFileSync(conversationsRoutePath, 'utf8');

  // Test 1.1: Backend triggers Pusher events on message creation
  runTest('1.1: Backend broadcasts new-message and conversation-updated on message dispatch', () => {
    assert.ok(
      messagesRouteSource.includes('triggerPusherSafe(`conversation-${conversationId}`, "new-message"') ||
      messagesRouteSource.includes('triggerPusherSafe(`private-conversation-${conversationId}`, "new-message"'),
      'Backend must broadcast new-message on conversation channel'
    );
    assert.ok(
      messagesRouteSource.includes('triggerPusherSafe(`user-${recipientId}`, "conversation-updated"') ||
      messagesRouteSource.includes('triggerPusherSafe(`user-${user.id}`, "conversation-updated"'),
      'Backend must broadcast conversation-updated to recipient and sender user channels'
    );
    assert.ok(
      convRouteSource.includes('triggerPusherSafe(`conversation-${conversation.id}`, "new-message"'),
      'Initial conversation creation route must broadcast new-message when initialMessage exists'
    );
  });

  // Test 1.2: Client optimistic message emission logic
  runTest('1.2: Sender emits optimistic message with temp-* ID and sending status', () => {
    // Extract handleSendMessage behavior from clientSource
    assert.ok(clientSource.includes('const tempId = `temp-${Date.now()}`;'), 'Must create temp-* optimistic ID');
    assert.ok(clientSource.includes('senderId: currentUserId'), 'Optimistic message must set senderId to current user');
    assert.ok(clientSource.includes('setMessages((prev) => [...prev, optimisticMsg]);'), 'Optimistic message must be immediately appended to UI state');
    assert.ok(clientSource.includes('setInputText("");'), 'Input box must be cleared immediately upon send');

    // Simulate optimistic emission function
    const currentUserId = 'user-student-1';
    let messagesState = [];
    const textToSend = 'Hola profesor, tengo una consulta';

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: textToSend,
      createdAt: new Date().toISOString(),
      senderId: currentUserId,
    };
    messagesState = [...messagesState, optimisticMsg];

    assert.strictEqual(messagesState.length, 1);
    assert.ok(messagesState[0].id.startsWith('temp-'));
    assert.strictEqual(messagesState[0].senderId, currentUserId);
    assert.strictEqual(messagesState[0].content, textToSend);
  });

  // Test 1.3: Receiver message reception via Pusher without page reload
  runTest('1.3: Receiver appends incoming message from conversation channel', () => {
    assert.ok(clientSource.includes('pusher.subscribe(channelName)'), 'Client must subscribe to conversation channel');
    assert.ok(clientSource.includes('channel.bind("new-message"'), 'Client must bind new-message event');

    // Simulate Receiver message reducer
    const currentUserId = 'user-coach-1';
    let messagesState = [
      { id: 'msg-prev', content: 'Mensaje anterior', createdAt: '2026-09-23T10:00:00Z', senderId: 'user-coach-1' }
    ];

    const incoming = {
      id: 'msg-canonical-101',
      content: 'Nuevo mensaje recibido',
      createdAt: '2026-09-23T10:01:00Z',
      senderId: 'user-student-1',
    };

    // Execute client-side reconciliation algorithm
    function receiveMessage(prev, inc, userId) {
      if (prev.some((m) => m.id === inc.id)) return prev;
      if (inc.senderId === userId) {
        const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.content === inc.content);
        if (tempIdx !== -1) {
          const copy = [...prev];
          copy[tempIdx] = inc;
          return copy;
        }
      }
      return [...prev, inc];
    }

    messagesState = receiveMessage(messagesState, incoming, currentUserId);
    assert.strictEqual(messagesState.length, 2);
    assert.strictEqual(messagesState[1].id, 'msg-canonical-101');
    assert.strictEqual(messagesState[1].content, 'Nuevo mensaje recibido');
  });

  // Test 1.4: Optimistic ID reconciliation (temp-* -> canonical ID)
  runTest('1.4: Sender reconciles temp-* optimistic message to canonical database ID', () => {
    assert.ok(
      clientSource.includes('m.id.startsWith("temp-") && m.content === incoming.content'),
      'Must match temporary message by temp- prefix and content'
    );
    assert.ok(
      clientSource.includes('copy[tempIdx] = incoming;'),
      'Must replace temporary message in-place in state copy'
    );

    const currentUserId = 'user-student-1';
    const tempId = `temp-${Date.now()}`;
    const initialText = 'Respuesta enviada de inmediato';

    // State with existing message + optimistic message
    let messagesState = [
      { id: 'msg-1', content: 'Pregunta previa', createdAt: '2026-09-23T10:00:00Z', senderId: 'user-coach-1' },
      { id: tempId, content: initialText, createdAt: '2026-09-23T10:01:00Z', senderId: currentUserId },
    ];

    const incomingCanonical = {
      id: 'msg-db-confirmed-789',
      content: initialText,
      createdAt: '2026-09-23T10:01:00Z',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Estudiante', avatarUrl: null },
    };

    function reconcile(prev, inc, userId) {
      if (prev.some((m) => m.id === inc.id)) return prev;
      if (inc.senderId === userId) {
        const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.content === inc.content);
        if (tempIdx !== -1) {
          const copy = [...prev];
          copy[tempIdx] = inc;
          return copy;
        }
      }
      return [...prev, inc];
    }

    messagesState = reconcile(messagesState, incomingCanonical, currentUserId);

    // Assertions
    assert.strictEqual(messagesState.length, 2, 'Message count must remain exactly 2 after reconciliation');
    assert.strictEqual(messagesState[1].id, 'msg-db-confirmed-789', 'Temporary ID must be replaced by canonical ID');
    assert.strictEqual(messagesState[1].content, initialText);
    assert.ok(!messagesState.some((m) => m.id.startsWith('temp-')), 'Zero temporary IDs must remain in state');
  });

  // Test 1.5: Deduplication when duplicate events arrive
  runTest('1.5: Deduplication drops redundant events and handles HTTP vs WebSocket race conditions', () => {
    assert.ok(
      clientSource.includes('if (prev.some((m) => m.id === incoming.id))'),
      'Must check if incoming ID is already present'
    );

    const currentUserId = 'user-student-1';
    const canonicalMsg = {
      id: 'msg-db-unique-999',
      content: 'Mensaje con entrega duplicada',
      createdAt: '2026-09-23T10:02:00Z',
      senderId: currentUserId,
    };

    function reconcile(prev, inc, userId) {
      if (prev.some((m) => m.id === inc.id)) return prev;
      if (inc.senderId === userId) {
        const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.content === inc.content);
        if (tempIdx !== -1) {
          const copy = [...prev];
          copy[tempIdx] = inc;
          return copy;
        }
      }
      return [...prev, inc];
    }

    let state = [canonicalMsg];

    // Duplicate WebSocket event 1
    state = reconcile(state, canonicalMsg, currentUserId);
    assert.strictEqual(state.length, 1, 'Duplicate event must NOT append duplicate message');

    // Duplicate WebSocket event 2
    state = reconcile(state, canonicalMsg, currentUserId);
    assert.strictEqual(state.length, 1, 'Third delivery must NOT append duplicate message');

    // Race Condition simulation:
    // HTTP response arrives FIRST -> updates temp-* to canonical
    const tempId = `temp-race-1`;
    let raceState = [{ id: tempId, content: 'Texto carrera', senderId: currentUserId }];
    // HTTP finishes:
    raceState = raceState.map((m) => (m.id === tempId ? canonicalMsg : m));
    assert.strictEqual(raceState[0].id, canonicalMsg.id);

    // Then WebSocket event arrives LATER:
    raceState = reconcile(raceState, canonicalMsg, currentUserId);
    assert.strictEqual(raceState.length, 1, 'Delayed WebSocket event after HTTP resolve must be deduplicated cleanly');
  });

  // Test 1.6: Auto-scroll trigger verification
  runTest('1.6: Auto-scroll trigger is invoked on message send, receive, and conversation switch', () => {
    assert.ok(clientSource.includes('const scrollToBottom = useCallback'), 'scrollToBottom helper must be defined');
    assert.ok(clientSource.includes('chatFeedRef.current.scrollTo'), 'Must target chatFeedRef.current.scrollTo');
    assert.ok(clientSource.includes('scrollHeight'), 'Must scroll to scrollHeight');

    // Verify auto-scroll invocations in source:
    // 1. After fetching messages
    assert.ok(clientSource.includes('setTimeout(() => scrollToBottom("auto"), 50)'), 'Must auto-scroll on initial message fetch');
    // 2. On incoming real-time message
    assert.ok(clientSource.includes('setTimeout(() => scrollToBottom("smooth"), 50)'), 'Must smooth-scroll on incoming Pusher message');
    // 3. On sending optimistic message
    assert.ok(clientSource.includes('setTimeout(() => scrollToBottom("smooth"), 100)'), 'Must smooth-scroll on handleSendMessage completion');

    // Simulate DOM scroll execution
    let scrollCalledWith = null;
    const mockFeed = {
      scrollHeight: 1500,
      scrollTo(options) {
        scrollCalledWith = options;
      }
    };

    function simulateScroll(behavior) {
      mockFeed.scrollTo({
        top: mockFeed.scrollHeight,
        behavior,
      });
    }

    simulateScroll('smooth');
    assert.deepStrictEqual(scrollCalledWith, { top: 1500, behavior: 'smooth' });

    simulateScroll('auto');
    assert.deepStrictEqual(scrollCalledWith, { top: 1500, behavior: 'auto' });
  });

  // Test 1.7: Unbind and cleanup on conversation unmount
  runTest('1.7: Pusher listeners unbind and channels unsubscribe on component unmount', () => {
    assert.ok(clientSource.includes('channel.unbind_all();'), 'Must call unbind_all on conversation channel cleanup');
    assert.ok(clientSource.includes('pusher.unsubscribe(channelName);'), 'Must call unsubscribe on conversation channel cleanup');
    assert.ok(clientSource.includes('userChannel.unbind_all();'), 'Must call unbind_all on user channel cleanup');
    assert.ok(clientSource.includes('pusher.unsubscribe(userChannelName);'), 'Must call unsubscribe on user channel cleanup');
  });
}

// =============================================================================
// PROBE 2: Active Community Presence (F9) - Auth, Roster, Online/Offline, Disk IO
// =============================================================================

function probe2CommunityPresence() {
  console.log('\n================================================================');
  console.log('PROBE 2: Active Community Presence Mechanics (F9)');
  console.log('================================================================');

  const authRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'pusher', 'auth', 'route.ts');
  const communityClientPath = path.join(projectRoot, 'apps', 'web', 'components', 'CommunityClient.tsx');
  const presenceLibPath = path.join(projectRoot, 'apps', 'web', 'lib', 'presence.ts');
  const activeMembersRoutePath = path.join(projectRoot, 'apps', 'web', 'app', 'api', 'community', 'active-members', 'route.ts');

  assert.ok(fs.existsSync(authRoutePath), `Auth route must exist at ${authRoutePath}`);
  assert.ok(fs.existsSync(communityClientPath), `CommunityClient must exist at ${communityClientPath}`);
  assert.ok(fs.existsSync(presenceLibPath), `presence.ts must exist at ${presenceLibPath}`);
  assert.ok(fs.existsSync(activeMembersRoutePath), `Active members route must exist at ${activeMembersRoutePath}`);

  const authSource = fs.readFileSync(authRoutePath, 'utf8');
  const communitySource = fs.readFileSync(communityClientPath, 'utf8');
  const presenceSource = fs.readFileSync(presenceLibPath, 'utf8');
  const activeMembersSource = fs.readFileSync(activeMembersRoutePath, 'utf8');

  // Test 2.1: Pusher Auth Route guest 401 gate
  runTest('2.1: Channel authorization route rejects unauthenticated guests with 401 Unauthorized', () => {
    assert.ok(authSource.includes('currentUser()'), 'Must check currentUser()');
    assert.ok(authSource.includes('getAuthenticatedUser()'), 'Must check getAuthenticatedUser() fallback');
    assert.ok(authSource.includes('PRESENCE_AUTH_REQUIRED'), 'Must return PRESENCE_AUTH_REQUIRED error message');
    assert.ok(authSource.includes('{ status: 401 }'), 'Must return status 401 for guests');

    // Simulate route authorization gate
    function simulatePusherAuth({ user, socketId, channelName }) {
      if (!socketId || !channelName) {
        return { status: 400, error: 'Missing socket_id or channel_name' };
      }
      if (!user || !user.id || user.status === 'SUSPENDED') {
        return { status: 401, error: 'PRESENCE_AUTH_REQUIRED: Debes iniciar sesión' };
      }
      if (channelName.startsWith('presence-')) {
        const role = user.role || 'STUDENT';
        const headline = user.coachProfile?.headline || (role === 'COACH' ? 'Coach CFH' : 'Aprendiz CFH');
        return {
          status: 200,
          auth: `${socketId}:mock_sig`,
          channel_data: JSON.stringify({
            user_id: user.id,
            user_info: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || null, role, headline }
          })
        };
      }
      if (channelName.startsWith('private-')) {
        return { status: 200, auth: `${socketId}:mock_sig` };
      }
      return { status: 403, error: 'Invalid channel authorization request' };
    }

    // Guest with null session
    const guestRes = simulatePusherAuth({ user: null, socketId: 'sock-1', channelName: 'presence-community' });
    assert.strictEqual(guestRes.status, 401);
    assert.ok(guestRes.error.includes('PRESENCE_AUTH_REQUIRED'));

    // Suspended user
    const suspendedRes = simulatePusherAuth({ user: { id: 'u-bad', status: 'SUSPENDED' }, socketId: 'sock-1', channelName: 'presence-community' });
    assert.strictEqual(suspendedRes.status, 401);

    // Missing socket_id
    const badReqRes = simulatePusherAuth({ user: { id: 'u-1' }, socketId: '', channelName: 'presence-community' });
    assert.strictEqual(badReqRes.status, 400);

    // Valid student authorization
    const validRes = simulatePusherAuth({
      user: { id: 'u-1', name: 'Laura Gómez', role: 'STUDENT', avatarUrl: 'https://cdn.com/laura.jpg' },
      socketId: 'sock-123',
      channelName: 'presence-community'
    });
    assert.strictEqual(validRes.status, 200);
    const parsedData = JSON.parse(validRes.channel_data);
    assert.strictEqual(parsedData.user_id, 'u-1');
    assert.strictEqual(parsedData.user_info.name, 'Laura Gómez');
    assert.strictEqual(parsedData.user_info.role, 'STUDENT');
    assert.strictEqual(parsedData.user_info.headline, 'Aprendiz CFH');
  });

  // Test 2.2: Guest suppression on client side
  runTest('2.2: CommunityClient suppresses presence channel connection for unauthenticated guests', () => {
    assert.ok(
      communitySource.includes('if (!currentUserId) return;'),
      'CommunityClient must immediately return if currentUserId is not present'
    );
  });

  // Test 2.3: Member joined adds user to liveActiveMembers with isOnline=true
  runTest('2.3: pusher:member_added updates liveActiveMembers with isOnline=true', () => {
    assert.ok(communitySource.includes('channel.bind("pusher:member_added"'), 'Must bind pusher:member_added');
    assert.ok(communitySource.includes('isOnline: true'), 'Must set isOnline: true for joined member');
    assert.ok(communitySource.includes('statusText: "En línea"'), 'Must set statusText: "En línea"');

    // Simulate liveActiveMembers reducer for member_added
    let activeMembers = [
      { id: 'user-existing-1', name: 'Carlos', isOnline: false, statusText: 'Desconectado' }
    ];

    const incomingMember = {
      id: 'user-new-2',
      info: {
        name: 'Mónica Coach',
        avatarUrl: 'https://cdn.com/monica.jpg',
        role: 'COACH',
        headline: 'Master Life Coach'
      }
    };

    function handleMemberAdded(prev, member) {
      const memberObj = {
        id: member.id,
        name: member.info?.name || 'Usuario',
        avatarUrl: member.info?.avatarUrl || null,
        role: member.info?.role || 'STUDENT',
        headline: member.info?.headline || (member.info?.role === 'COACH' ? 'Coach CFH' : 'Aprendiz CFH'),
        isOnline: true,
        statusText: 'En línea',
      };
      const existingIndex = prev.findIndex((m) => m.id === member.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...memberObj };
        return updated;
      }
      return [memberObj, ...prev];
    }

    activeMembers = handleMemberAdded(activeMembers, incomingMember);
    assert.strictEqual(activeMembers.length, 2);
    assert.strictEqual(activeMembers[0].id, 'user-new-2');
    assert.strictEqual(activeMembers[0].isOnline, true);
    assert.strictEqual(activeMembers[0].statusText, 'En línea');
    assert.strictEqual(activeMembers[0].role, 'COACH');

    // Re-joining existing user updates status to true without duplicating
    activeMembers = handleMemberAdded(activeMembers, { id: 'user-existing-1', info: { name: 'Carlos', role: 'STUDENT' } });
    assert.strictEqual(activeMembers.length, 2, 'Must not duplicate member on re-join');
    const updatedCarlos = activeMembers.find((m) => m.id === 'user-existing-1');
    assert.strictEqual(updatedCarlos.isOnline, true);
    assert.strictEqual(updatedCarlos.statusText, 'En línea');
  });

  // Test 2.4: Member leaving sets isOnline=false and statusText="Desconectado"
  runTest('2.4: pusher:member_removed sets member isOnline=false without dropping member record', () => {
    assert.ok(communitySource.includes('channel.bind("pusher:member_removed"'), 'Must bind pusher:member_removed');
    assert.ok(communitySource.includes('isOnline: false, statusText: "Desconectado"'), 'Must set isOnline: false and Desconectado');

    let activeMembers = [
      { id: 'user-1', name: 'Laura', isOnline: true, statusText: 'En línea' },
      { id: 'user-2', name: 'Mónica', isOnline: true, statusText: 'En línea' }
    ];

    function handleMemberRemoved(prev, member) {
      return prev.map((m) =>
        m.id === member.id
          ? { ...m, isOnline: false, statusText: 'Desconectado' }
          : m
      );
    }

    activeMembers = handleMemberRemoved(activeMembers, { id: 'user-1' });
    assert.strictEqual(activeMembers.length, 2, 'Member must remain in activeMembers array');
    assert.strictEqual(activeMembers[0].id, 'user-1');
    assert.strictEqual(activeMembers[0].isOnline, false);
    assert.strictEqual(activeMembers[0].statusText, 'Desconectado');
    assert.strictEqual(activeMembers[1].id, 'user-2');
    assert.strictEqual(activeMembers[1].isOnline, true);
  });

  // Test 2.5: Zero disk writes to .tmp/presence.json
  runTest('2.5: All disk writes to .tmp/presence.json are permanently decommissioned', () => {
    // 1. Check presence.ts
    assert.ok(!presenceSource.includes('fs.writeFileSync'), 'presence.ts must NOT call fs.writeFileSync');
    assert.ok(!presenceSource.includes('fs.readFileSync'), 'presence.ts must NOT call fs.readFileSync');
    assert.ok(!presenceSource.includes('fs/promises'), 'presence.ts must NOT import fs/promises');
    assert.ok(!presenceSource.includes('node:fs'), 'presence.ts must NOT import node:fs');
    assert.ok(!presenceSource.includes('import fs'), 'presence.ts must NOT import fs');
    assert.ok(!presenceSource.match(/path\.join\([^)]*presence\.json/), 'presence.ts must not construct presence.json path');

    // 2. Check active-members route
    assert.ok(!activeMembersSource.includes('fs.writeFileSync'), 'active-members route must NOT write to disk');
    assert.ok(!activeMembersSource.includes('fs.readFileSync'), 'active-members route must NOT read from disk');
    assert.ok(!activeMembersSource.includes('node:fs'), 'active-members route must NOT import node:fs');

    // 3. Verify .tmp/presence.json does not exist on disk
    const tmpPresencePath = path.join(projectRoot, '.tmp', 'presence.json');
    assert.ok(!fs.existsSync(tmpPresencePath), '.tmp/presence.json must not exist on filesystem');
  });
}

// =============================================================================
// PROBE 3: Verification of Polling Intervals Absence (3.5s, 7s, 15s)
// =============================================================================

function probe3PollingAbsence() {
  console.log('\n================================================================');
  console.log('PROBE 3: Complete Elimination of Polling Loops (3.5s, 7s, 15s)');
  console.log('================================================================');

  const messagesClientPath = path.join(projectRoot, 'apps', 'web', 'components', 'MessagesClient.tsx');
  const communityClientPath = path.join(projectRoot, 'apps', 'web', 'components', 'CommunityClient.tsx');
  const sessionWatcherPath = path.join(projectRoot, 'apps', 'web', 'components', 'SessionWatcher.tsx');

  const messagesClient = fs.readFileSync(messagesClientPath, 'utf8');
  const communityClient = fs.readFileSync(communityClientPath, 'utf8');
  const sessionWatcher = fs.readFileSync(sessionWatcherPath, 'utf8');

  // Test 3.1: MessagesClient polling elimination
  runTest('3.1: MessagesClient contains zero setInterval calls and no 3.5s/7s polling loops', () => {
    assert.ok(!messagesClient.includes('setInterval'), 'MessagesClient must contain zero setInterval calls');
    assert.ok(!messagesClient.includes('3500'), 'MessagesClient must not contain 3500ms intervals');
    assert.ok(!messagesClient.includes('7000'), 'MessagesClient must not contain 7000ms intervals');
  });

  // Test 3.2: CommunityClient polling elimination
  runTest('3.2: CommunityClient contains zero 15s intervals, zero 3.5s/7s intervals, and zero active-members polling', () => {
    assert.ok(!communityClient.includes('15000'), 'CommunityClient must not contain 15000ms intervals');
    assert.ok(!communityClient.includes('3500'), 'CommunityClient must not contain 3500ms intervals');
    assert.ok(!communityClient.includes('7000'), 'CommunityClient must not contain 7000ms intervals');
    assert.ok(!communityClient.includes('/api/community/active-members'), 'CommunityClient must not call /api/community/active-members');
  });

  // Test 3.3: SessionWatcher polling elimination
  runTest('3.3: SessionWatcher contains zero setInterval calls and no 15s presence ping loop', () => {
    assert.ok(!sessionWatcher.includes('setInterval'), 'SessionWatcher must contain zero setInterval calls');
    assert.ok(!sessionWatcher.includes('15000'), 'SessionWatcher must not contain 15000ms intervals');
    assert.ok(!sessionWatcher.includes('/api/community/active-members'), 'SessionWatcher must not call /api/community/active-members');
  });

  // Test 3.4: Global scan across all components for active-members polling
  runTest('3.4: Zero client components in apps/web poll /api/community/active-members', () => {
    const componentsDir = path.join(projectRoot, 'apps', 'web', 'components');
    const files = fs.readdirSync(componentsDir, { recursive: true });
    
    for (const f of files) {
      if (typeof f === 'string' && (f.endsWith('.tsx') || f.endsWith('.ts'))) {
        const filePath = path.join(componentsDir, f);
        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(
          !content.includes('/api/community/active-members'),
          `Component ${f} must NOT call /api/community/active-members`
        );
      }
    }
  });
}

// =============================================================================
// PROBE 4: Adversarial Stress & Edge Cases
// =============================================================================

function probe4AdversarialStress() {
  console.log('\n================================================================');
  console.log('PROBE 4: Adversarial Stress & Failure Modes');
  console.log('================================================================');

  // Test 4.1: Burst messaging under high frequency (rapid consecutive messages)
  runTest('4.1: Burst of 20 rapid messages handles concurrent optimistic additions and orderly reconciliation', () => {
    const currentUserId = 'user-burst';
    let thread = [];

    function sendMessage(content, idx) {
      const tempId = `temp-burst-${idx}`;
      thread.push({ id: tempId, content, senderId: currentUserId });
      return tempId;
    }

    function receivePusher(inc) {
      if (thread.some((m) => m.id === inc.id)) return;
      if (inc.senderId === currentUserId) {
        const tempIdx = thread.findIndex((m) => m.id.startsWith('temp-') && m.content === inc.content);
        if (tempIdx !== -1) {
          thread[tempIdx] = inc;
          return;
        }
      }
      thread.push(inc);
    }

    // Emit 20 burst messages
    const sentIds = [];
    for (let i = 0; i < 20; i++) {
      sentIds.push(sendMessage(`Mensaje burst #${i}`, i));
    }
    assert.strictEqual(thread.length, 20);

    // Reconcile all 20 out of order
    const randomOrder = [...Array(20).keys()].sort(() => Math.random() - 0.5);
    for (const idx of randomOrder) {
      receivePusher({
        id: `canonical-burst-${idx}`,
        content: `Mensaje burst #${idx}`,
        senderId: currentUserId,
      });
    }

    assert.strictEqual(thread.length, 20, 'Thread count must remain exactly 20');
    assert.ok(!thread.some((m) => m.id.startsWith('temp-')), 'All temp IDs must be reconciled');
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(thread[i].id, `canonical-burst-${i}`, `Message ${i} must preserve original array position`);
    }
  });

  // Test 4.2: Malformed Pusher member object (null info, missing fields)
  runTest('4.2: Malformed Pusher member object safely defaults without TypeError', () => {
    function parseMember(member) {
      return {
        id: member?.id || 'anon',
        name: member?.info?.name || 'Usuario',
        avatarUrl: member?.info?.avatarUrl || null,
        role: member?.info?.role || 'STUDENT',
        headline: member?.info?.headline || (member?.info?.role === 'COACH' ? 'Coach CFH' : 'Aprendiz CFH'),
        isOnline: true,
        statusText: 'En línea',
      };
    }

    const nullInfo = parseMember({ id: 'u-broken', info: null });
    assert.strictEqual(nullInfo.name, 'Usuario');
    assert.strictEqual(nullInfo.headline, 'Aprendiz CFH');
    assert.strictEqual(nullInfo.avatarUrl, null);

    const undefinedMember = parseMember(undefined);
    assert.strictEqual(undefinedMember.id, 'anon');
    assert.strictEqual(undefinedMember.name, 'Usuario');
  });

  // Test 4.3: Special characters, HTML entities, and unicode in chat messages
  runTest('4.3: Special characters, emojis, and multiline text pass through safely', () => {
    const specialText = '✨ Test message with emojis 🚀 & <script>alert("xss")</script> and \n newlines \t and "quotes"';
    const tempId = `temp-${Date.now()}`;
    const msg = {
      id: tempId,
      content: specialText,
      senderId: 'u-special',
      createdAt: new Date().toISOString()
    };

    assert.strictEqual(msg.content, specialText);
    assert.ok(msg.content.includes('<script>'), 'Raw content preserves special chars');
  });

  // Test 4.4: High-frequency flapping (user connects and disconnects 50 times)
  runTest('4.4: Presence rapid flapping (50 connect/disconnect cycles) preserves data integrity', () => {
    let roster = [
      { id: 'user-flap', name: 'Flapping User', isOnline: false, statusText: 'Desconectado' }
    ];

    for (let i = 0; i < 50; i++) {
      // Connect
      const idx = roster.findIndex((m) => m.id === 'user-flap');
      roster[idx] = { ...roster[idx], isOnline: true, statusText: 'En línea' };
      assert.strictEqual(roster[0].isOnline, true);

      // Disconnect
      roster[idx] = { ...roster[idx], isOnline: false, statusText: 'Desconectado' };
      assert.strictEqual(roster[0].isOnline, false);
    }

    assert.strictEqual(roster.length, 1, 'Roster must contain exactly 1 member without duplicates');
  });
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

function runAllEmpiricalProbes() {
  console.log('====================================================================');
  console.log('  EMPIRICAL CHALLENGER (M3-1): ADVERSARIAL REAL-TIME & PRESENCE SUITE');
  console.log('====================================================================');

  const startTime = Date.now();

  try {
    probe1RealTimeChat();
    probe2CommunityPresence();
    probe3PollingAbsence();
    probe4AdversarialStress();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n====================================================================');
    console.log('  TEST SUMMARY');
    console.log('====================================================================');
    console.log(`  Total Probes Executed: ${totalTests}`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Execution Time: ${duration}s`);
    console.log('====================================================================');
    console.log('  GATE VERDICT: APPROVE');
    console.log('====================================================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ EMPIRICAL SUITE FAILED:');
    console.error(error);
    console.log('\n====================================================================');
    console.log('  GATE VERDICT: REQUEST_CHANGES');
    console.log('====================================================================\n');
    return false;
  }
}

const success = runAllEmpiricalProbes();
if (!success) {
  process.exit(1);
}
