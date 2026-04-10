fetch('https://room-68.vercel.app/')
  .then(r => r.text())
  .then(html => {
    const scriptMatch = html.match(/src="[^"]*assets[^"]*\.js"/g);
    console.log('Scripts found:', scriptMatch);
    const cssMatch = html.match(/href="[^"]*assets[^"]*\.css"/g);
    console.log('CSS found:', cssMatch);
  })
  .catch(err => console.error('Error:', err));
