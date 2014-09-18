#ifndef	__GLOBALS_H__
#define __GLOBALS_H__

extern "C"
{
	// GLOBAL APPLICATION (DATA) PATH
	#ifndef APPLICATION_PATH
	#define APPLICATION_PATH "/opt/tissuestack"
	#endif
	// HELPS US TO ASSEMBLE SUB-DIRECTORIES BASED ON THE ROOT PATH
	#define CONCAT_APP_PATH(PATH_TO_BE_ADDED) APPLICATION_PATH "/" PATH_TO_BE_ADDED

	#define DATASET_PATH CONCAT_APP_PATH("data")
	#define COLORMAP_PATH CONCAT_APP_PATH("colormaps")
	#define LOG_PATH CONCAT_APP_PATH("logs")
	#define LABEL_LOOKUP_PATH CONCAT_APP_PATH("lookup")
	#define TASKS_PATH CONCAT_APP_PATH("tasks")
	#define UPLOAD_PATH CONCAT_APP_PATH("upload")
}

#endif	/* __GLOBALS_H__ */
