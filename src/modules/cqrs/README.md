## CQRS

> Given [entity] at state [state]
> When [event] occurs
> We shall [rules]

- [Command] -*> [Event]
- [rule] -*> [Action]
- [Action] -*> [job]

### case 1. upload
* create UploadCommand `state: open`
* create ImageUploadEvent `state: processing`
    * create ImageUploadEventRule
        * CreateThumbnailAction
            * CreateThumbnailJob
        * UploadImageAction
            * UploadFilesJob
        
        
### case 2. transcode
* create UploadVideoCommand
* create VideoUploadEvent
    1. create ShortVideoUploadEventRule
        * CreateThumbnailAction ...
        * AddWatermarkAction ...
        * CreateGifAction ...
        * CreateStoryboardAction ...
    2. create LargeVideoUploadEventRule
        * CreateThumbnailAction ...
        * AddWatermarkAction ...
        * CreateGifAction ...
        * CreateStoryboardAction ...
        * UploadLargeFilesAction
            * BatchUploadFilesJob
