from PIL import Image
import os

paths = [
    '/Users/bill/src/antigravity/SpacePotatoes/public/potato.png',
    '/Users/bill/src/antigravity/SpacePotatoes/pygame_version/assets/potato.png'
]

for p in paths:
    if os.path.exists(p):
        img = Image.open(p).convert("RGBA")
        datas = img.getdata()
        newData = []
        for item in datas:
            # Check if pixel is white or very close to white
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
        img.putdata(newData)
        img.save(p, "PNG")
        print(f"Processed {p}")
