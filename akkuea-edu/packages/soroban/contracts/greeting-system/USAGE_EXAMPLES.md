# Greeting System - Usage Examples

This guide provides practical examples of how to interact with the Greeting System smart contract.

## Prerequisites

- Stellar account with testnet XLM
- Soroban CLI installed
- Contract deployed on testnet

## Setup

```bash
# Set environment variables
export CONTRACT_ID="<your-contract-id>"
export SECRET_KEY="<your-secret-key>"
export RPC_URL="https://soroban-testnet.stellar.org"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
```

## Example 1: Initialize the Contract

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize
```

**Expected Output:**
```
Success
```

---

## Example 2: Create a Greeting

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- create_greeting \
  --creator GABC123... \
  --message "Hello, Stellar community!"
```

**Expected Output:**
```
1
```
(Returns the greeting ID)

**JavaScript/TypeScript Example:**
```typescript
import { Contract, SorobanRpc } from '@stellar/stellar-sdk';

const contract = new Contract(contractId);
const server = new SorobanRpc.Server(rpcUrl);

const result = await contract.call(
  'create_greeting',
  {
    creator: userAddress,
    message: 'Hello, Stellar community!'
  },
  {
    source: userKeypair,
    server: server
  }
);

console.log('Greeting ID:', result);
```

---

## Example 3: Get a Greeting

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_greeting \
  --greeting_id 1
```

**Expected Output:**
```json
{
  "id": 1,
  "creator": "GABC123...",
  "message": "Hello, Stellar community!",
  "timestamp": 1234567890
}
```

**JavaScript/TypeScript Example:**
```typescript
const greeting = await contract.call('get_greeting', {
  greeting_id: 1
});

console.log('Greeting:', greeting);
console.log('Creator:', greeting.creator);
console.log('Message:', greeting.message);
console.log('Created at:', new Date(greeting.timestamp * 1000));
```

---

## Example 4: Like a Greeting

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- like_greeting \
  --greeting_id 1 \
  --user GXYZ789...
```

**Expected Output:**
```
1
```
(Returns the updated like count)

**JavaScript/TypeScript Example:**
```typescript
const likeCount = await contract.call(
  'like_greeting',
  {
    greeting_id: 1,
    user: userAddress
  },
  {
    source: userKeypair,
    server: server
  }
);

console.log('Total likes:', likeCount);
```

---

## Example 5: Comment on a Greeting

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- comment_on_greeting \
  --greeting_id 1 \
  --user GXYZ789... \
  --text "Great greeting! Welcome to Stellar!"
```

**Expected Output:**
```
1
```
(Returns the comment count)

**JavaScript/TypeScript Example:**
```typescript
const commentCount = await contract.call(
  'comment_on_greeting',
  {
    greeting_id: 1,
    user: userAddress,
    text: 'Great greeting! Welcome to Stellar!'
  },
  {
    source: userKeypair,
    server: server
  }
);

console.log('Total comments:', commentCount);
```

---

## Example 6: Get Like Count

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_like_count \
  --greeting_id 1
```

**Expected Output:**
```
5
```

**JavaScript/TypeScript Example:**
```typescript
const likeCount = await contract.call('get_like_count', {
  greeting_id: 1
});

console.log('Likes:', likeCount);
```

---

## Example 7: Get All Comments

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_comments \
  --greeting_id 1
```

**Expected Output:**
```json
[
  {
    "greeting_id": 1,
    "user": "GXYZ789...",
    "action": "comment",
    "comment_text": "Great greeting!",
    "timestamp": 1234567900
  },
  {
    "greeting_id": 1,
    "user": "GABC456...",
    "action": "comment",
    "comment_text": "Welcome!",
    "timestamp": 1234567910
  }
]
```

**JavaScript/TypeScript Example:**
```typescript
const comments = await contract.call('get_comments', {
  greeting_id: 1
});

comments.forEach((comment, index) => {
  console.log(`Comment ${index + 1}:`);
  console.log('  User:', comment.user);
  console.log('  Text:', comment.comment_text);
  console.log('  Time:', new Date(comment.timestamp * 1000));
});
```

---

## Example 8: Check if User Liked

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- has_user_liked \
  --greeting_id 1 \
  --user GXYZ789...
```

**Expected Output:**
```
true
```

**JavaScript/TypeScript Example:**
```typescript
const hasLiked = await contract.call('has_user_liked', {
  greeting_id: 1,
  user: userAddress
});

if (hasLiked) {
  console.log('User has already liked this greeting');
} else {
  console.log('User has not liked this greeting yet');
}
```

---

## Example 9: Get Total Greeting Count

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_greeting_count
```

**Expected Output:**
```
42
```

**JavaScript/TypeScript Example:**
```typescript
const totalGreetings = await contract.call('get_greeting_count');
console.log('Total greetings created:', totalGreetings);
```

---

## Example 10: Complete Workflow

**Scenario:** Alice creates a greeting, Bob likes it, and Charlie comments on it.

```bash
# 1. Alice creates a greeting
GREETING_ID=$(soroban contract invoke \
  --id $CONTRACT_ID \
  --source $ALICE_SECRET \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- create_greeting \
  --creator $ALICE_ADDRESS \
  --message "Hello from Alice!")

echo "Created greeting ID: $GREETING_ID"

# 2. Bob likes the greeting
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $BOB_SECRET \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- like_greeting \
  --greeting_id $GREETING_ID \
  --user $BOB_ADDRESS

echo "Bob liked the greeting"

# 3. Charlie comments on the greeting
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $CHARLIE_SECRET \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- comment_on_greeting \
  --greeting_id $GREETING_ID \
  --user $CHARLIE_ADDRESS \
  --text "Nice to meet you, Alice!"

echo "Charlie commented on the greeting"

# 4. Get the greeting with all interactions
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_greeting \
  --greeting_id $GREETING_ID

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_like_count \
  --greeting_id $GREETING_ID

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --rpc-url $RPC_URL \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_comments \
  --greeting_id $GREETING_ID
```

---

## Error Handling Examples

### Example 11: Handling Duplicate Like

```typescript
try {
  await contract.call('like_greeting', {
    greeting_id: 1,
    user: userAddress
  });
} catch (error) {
  if (error.message.includes('already liked')) {
    console.log('You have already liked this greeting');
  } else {
    console.error('Error:', error);
  }
}
```

### Example 12: Handling Invalid Comment

```typescript
try {
  await contract.call('comment_on_greeting', {
    greeting_id: 1,
    user: userAddress,
    text: '' // Empty comment
  });
} catch (error) {
  if (error.message.includes('cannot be empty')) {
    console.log('Comment cannot be empty');
  } else {
    console.error('Error:', error);
  }
}
```

### Example 13: Handling Non-existent Greeting

```typescript
try {
  await contract.call('get_greeting', {
    greeting_id: 9999
  });
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Greeting does not exist');
  } else {
    console.error('Error:', error);
  }
}
```

---

## Best Practices

1. **Always check if greeting exists** before interacting with it
2. **Validate input** on the client side before calling contract
3. **Handle errors gracefully** with user-friendly messages
4. **Cache frequently accessed data** to reduce RPC calls
5. **Use events** to track contract activity off-chain
6. **Implement retry logic** for network failures
7. **Monitor gas costs** and optimize calls

---

## Integration with Frontend

### React Example

```typescript
import { useState, useEffect } from 'react';
import { Contract } from '@stellar/stellar-sdk';

function GreetingCard({ greetingId }) {
  const [greeting, setGreeting] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    loadGreeting();
  }, [greetingId]);

  async function loadGreeting() {
    const contract = new Contract(contractId);
    
    const [greetingData, likes, commentList] = await Promise.all([
      contract.call('get_greeting', { greeting_id: greetingId }),
      contract.call('get_like_count', { greeting_id: greetingId }),
      contract.call('get_comments', { greeting_id: greetingId })
    ]);

    setGreeting(greetingData);
    setLikeCount(likes);
    setComments(commentList);
  }

  async function handleLike() {
    try {
      const newCount = await contract.call('like_greeting', {
        greeting_id: greetingId,
        user: userAddress
      });
      setLikeCount(newCount);
    } catch (error) {
      alert('Error liking greeting: ' + error.message);
    }
  }

  async function handleComment(text) {
    try {
      await contract.call('comment_on_greeting', {
        greeting_id: greetingId,
        user: userAddress,
        text: text
      });
      await loadGreeting(); // Reload to show new comment
    } catch (error) {
      alert('Error posting comment: ' + error.message);
    }
  }

  return (
    <div className="greeting-card">
      <h3>{greeting?.message}</h3>
      <p>By: {greeting?.creator}</p>
      <button onClick={handleLike}>Like ({likeCount})</button>
      <div className="comments">
        {comments.map((comment, i) => (
          <div key={i}>
            <strong>{comment.user}:</strong> {comment.comment_text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Monitoring Events

```typescript
// Listen for greeting creation events
contract.on('grt_crtd', (event) => {
  console.log('New greeting created:', event);
});

// Listen for like events
contract.on('like', (event) => {
  console.log('Greeting liked:', event);
});

// Listen for comment events
contract.on('comment', (event) => {
  console.log('New comment:', event);
});
```

---

## Conclusion

These examples demonstrate the full capabilities of the Greeting System contract. For more information, see the README.md and TECHNICAL_DOCUMENTATION.md files.

